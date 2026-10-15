alter table public.adventures add column plan_revision integer not null default 0;

alter table public.messages add column plan_revision integer;
alter table public.messages add check ((kind = 'plan_update') = (plan_revision is not null));
alter table public.messages drop constraint messages_once;
alter table public.messages add constraint messages_once unique nulls not distinct
  (adventure_id, kind, round, for_deadline, plan_revision, channel, to_address);

drop function private.enqueue_to_contacts(uuid, public.message_kind, smallint);
create function private.enqueue_to_contacts(
  p_adventure_id uuid, p_kind public.message_kind, p_round smallint, p_plan_revision integer default null
)
returns void language sql security definer set search_path = '' as $$
  with reach as (
    select c.id as contact_id, ch.channel, ch.address, cfg.enabled
    from public.adventure_contacts ac
    join public.emergency_contacts c on c.id = ac.contact_id
    cross join lateral (values ('email'::public.channel, c.email), ('sms'::public.channel, c.phone)) ch (channel, address)
    join private.channel_config cfg on cfg.channel = ch.channel
    where ac.adventure_id = p_adventure_id and ch.address is not null
  )
  insert into public.messages (adventure_id, kind, round, plan_revision, channel, to_address, contact_id, status, failure_reason)
  select p_adventure_id, p_kind, p_round, p_plan_revision, r.channel, r.address, r.contact_id,
         case when r.enabled then 'pending' else 'failed' end::public.message_status,
         case when r.enabled then null else 'channel_not_enabled' end
  from reach r
  where r.enabled
     or (not exists (select 1 from reach o where o.contact_id = r.contact_id and o.enabled)
         and r.channel = (select min(o.channel) from reach o where o.contact_id = r.contact_id))
  on conflict on constraint messages_once do update
    set status = 'pending', attempts = 0, next_attempt_at = now(), lease_until = null
    where public.messages.status = 'cancelled' and public.messages.kind = 'heads_up'
$$;

create or replace function public.save_adventure(
  p_id uuid, p_destination text, p_route text, p_starting_point text, p_notes text,
  p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_contacts uuid[] := coalesce(p_contact_ids, '{}');
  a public.adventures;
  v_plan_changed boolean := false;
begin
  if exists (
    select 1 from unnest(v_contacts) as wanted (id)
    where not exists (
      select 1 from public.emergency_contacts c
      where c.id = wanted.id and c.adventurer_id = v_uid and c.removed_at is null
    )
  ) then
    return query select p_id, 'unknown_contact'::public.refusal;
    return;
  end if;

  if p_id is null then
    insert into public.adventures (adventurer_id, destination, route, starting_point, notes, deadline)
    values (v_uid, p_destination, p_route, p_starting_point, p_notes, p_deadline)
    returning * into a;
  else
    select * into a from public.adventures where id = p_id and adventurer_id = v_uid for update;
    if not found then
      return query select p_id, 'not_found'::public.refusal;
      return;
    end if;
    if a.stage not in ('planned', 'active', 'overdue') then
      return query select a.id, 'wrong_stage'::public.refusal;
      return;
    end if;
    if a.stage <> 'planned' and cardinality(v_contacts) = 0 then
      return query select a.id, 'no_contacts'::public.refusal;
      return;
    end if;
    if a.stage <> 'planned' and coalesce(btrim(p_destination), '') = '' then
      return query select a.id, 'destination_missing'::public.refusal;
      return;
    end if;

    v_plan_changed := a.stage <> 'planned'
      and (a.destination, a.route, a.starting_point, a.notes)
          is distinct from (p_destination, p_route, p_starting_point, p_notes);

    update public.adventures
       set destination = p_destination, route = p_route, starting_point = p_starting_point, notes = p_notes,
           plan_revision = plan_revision + v_plan_changed::int,
           deadline = case when a.stage = 'planned' then p_deadline else deadline end,
           updated_at = now()
     where id = a.id
    returning * into a;
  end if;

  delete from public.adventure_contacts where adventure_id = a.id and contact_id <> all (v_contacts);
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending' and contact_id <> all (v_contacts);

  -- Only contacts whose Heads-up already went out: an unsent Heads-up carries the latest Plan itself.
  if v_plan_changed then
    update public.messages set status = 'cancelled'
     where adventure_id = a.id and kind = 'plan_update' and status = 'pending';
    perform private.enqueue_to_contacts(a.id, 'plan_update', null, a.plan_revision);
    delete from public.messages m
     where m.adventure_id = a.id and m.kind = 'plan_update' and m.plan_revision = a.plan_revision
       and not exists (
         select 1 from public.messages h
         where h.adventure_id = a.id and h.kind = 'heads_up' and h.contact_id = m.contact_id
           and h.status in ('sent', 'failed'));
  end if;
  insert into public.adventure_contacts (adventure_id, contact_id)
  select a.id, unnest(v_contacts)
  on conflict do nothing;

  if a.stage <> 'planned' then
    perform private.reconcile(a.id);
  end if;

  return query select a.id, null::public.refusal;
end $$;

create or replace function public.message_facts(p_message_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'kind', m.kind,
           'adventurer_name', p.name,
           'contact_name', c.name,
           'time_zone', a.time_zone,
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route,
                                      'starting_point', a.starting_point, 'notes', a.notes),
           'deadline', coalesce(m.for_deadline, a.deadline))
         || case m.kind
              when 'heads_up' then jsonb_build_object('trail_token', ac.trail_token)
              when 'plan_update' then jsonb_build_object('trail_token', ac.trail_token)
              when 'alert' then jsonb_build_object(
                'round', m.round,
                'trail_token', ac.trail_token,
                'profile', jsonb_build_object('phone', p.phone, 'car_make', p.car_make, 'car_colour', p.car_colour,
                                              'car_plate', p.car_plate, 'medical_notes', p.medical_notes),
                'last_known_position', (
                  select jsonb_build_object('taken_at', r.taken_at, 'latitude', r.latitude,
                                            'longitude', r.longitude, 'accuracy_m', r.accuracy_m)
                  from public.position_readings r
                  where r.adventure_id = a.id
                  order by r.taken_at desc
                  limit 1))
              when 'overdue_notice' then jsonb_build_object('alert_at', private.alert_time(m.for_deadline))
              when 'all_clear' then jsonb_build_object('checked_in_at', a.checked_in_at)
              else '{}'::jsonb
            end
  from public.messages m
  join public.adventures a on a.id = m.adventure_id
  left join public.adventurer_profiles p on p.id = a.adventurer_id
  left join public.emergency_contacts c on c.id = m.contact_id
  left join public.adventure_contacts ac on ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id
  where m.id = p_message_id
$$;

create or replace function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')
returns setof public.messages language plpgsql security definer set search_path = '' as $$
begin
  -- A command cancels what it makes stale, but a row that was being sent at that moment can
  -- come back as a retry afterwards. Never an Alert: only check_in decides about those.
  update public.messages m set status = 'cancelled'
    from public.adventures a
   where a.id = m.adventure_id and m.status = 'pending' and (
         (m.kind in ('heads_up', 'plan_update') and (a.stage = 'ended' or not exists (
            select 1 from public.adventure_contacts ac
            where ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id)))
      or (m.kind in ('reminder', 'overdue_notice') and (a.stage = 'ended' or m.for_deadline <> a.deadline)));

  update public.messages set status = 'failed', failure_reason = 'retries_exhausted', lease_until = null
   where status = 'sending' and lease_until < now() and attempts >= private.max_attempts();

  update public.messages m set status = 'cancelled', failure_reason = 'no_alert_delivered'
   where m.kind = 'all_clear' and m.status = 'pending'
     and not exists (
       select 1 from public.messages e
       where e.adventure_id = m.adventure_id and e.kind = 'alert'
         and e.channel = m.channel and e.to_address = m.to_address
         and e.status in ('pending', 'sending', 'sent'));

  -- Per address: Alert round n waits for round n - 1, and an All-clear waits for every Alert.
  -- Nothing else blocks, so an Alert overtakes a Heads-up in retry backoff.
  return query
  with due as (
    select m.id from public.messages m
    where ((m.status = 'pending' and m.next_attempt_at <= now())
           or (m.status = 'sending' and m.lease_until < now()))
      and not exists (
        select 1 from public.messages e
        where e.adventure_id = m.adventure_id and e.channel = m.channel
          and e.to_address = m.to_address and e.id <> m.id
          and e.status in ('pending', 'sending')
          and ((m.kind = 'all_clear' and e.kind = 'alert')
               or (m.kind = 'alert' and e.kind = 'alert' and e.round < m.round)))
    order by m.id
    limit p_limit
    for update skip locked
  )
  update public.messages m
     set status = 'sending', lease_until = now() + p_lease, attempts = m.attempts + 1
    from due
   where m.id = due.id
  returning m.*;
end $$;

create or replace view public.delivery_failures with (security_invoker = true) as
  select m.id, m.adventure_id, m.kind, m.channel, m.to_address, m.contact_id,
         c.name as contact_name, m.round, m.failure_reason, m.created_at
  from public.messages m
  left join public.emergency_contacts c on c.id = m.contact_id
  where m.status = 'failed' and m.kind in ('heads_up', 'plan_update', 'alert', 'all_clear');
