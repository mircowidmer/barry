-- Moving the Deadline tells each contact whose Heads-up went out, a few minutes later, so that
-- quick moves in a row become one Deadline Update from the time the contact knew to the latest one.

alter table public.messages add column previous_deadline timestamptz;
alter table public.messages add check ((kind = 'deadline_update') = (previous_deadline is not null));
alter table public.messages drop constraint messages_once;
alter table public.messages add constraint messages_once unique nulls not distinct
  (adventure_id, kind, round, for_deadline, plan_revision, previous_deadline, channel, to_address);

create function private.deadline_update_delay() returns interval language sql immutable as $$
  select interval '3 minutes'
$$;

drop function private.enqueue_to_contacts(uuid, public.message_kind, smallint, integer);
create function private.enqueue_to_contacts(
  p_adventure_id uuid, p_kind public.message_kind, p_round smallint,
  p_plan_revision integer default null, p_previous_deadline timestamptz default null
)
returns void language sql security definer set search_path = '' as $$
  with reach as (
    select c.id as contact_id, ch.channel, ch.address, cfg.enabled
    from public.adventure_contacts ac
    join public.emergency_contacts c on c.id = ac.contact_id
    cross join lateral (values
      ('email'::public.channel, c.email, c.email_enabled),
      ('sms'::public.channel, c.phone, c.phone_enabled)
    ) ch (channel, address, switched_on)
    join private.channel_config cfg on cfg.channel = ch.channel
    where ac.adventure_id = p_adventure_id and ch.address is not null and ch.switched_on
  )
  insert into public.messages (
    adventure_id, kind, round, plan_revision, previous_deadline, channel, to_address, contact_id, status, failure_reason
  )
  select distinct on (r.channel, r.address)
         p_adventure_id, p_kind, p_round, p_plan_revision, p_previous_deadline, r.channel, r.address, r.contact_id,
         case when r.enabled then 'pending' else 'failed' end::public.message_status,
         case when r.enabled then null else 'channel_not_enabled' end
  from reach r
  where r.enabled
     or (not exists (select 1 from reach o where o.contact_id = r.contact_id and o.enabled)
         and r.channel = (select min(o.channel) from reach o where o.contact_id = r.contact_id))
  order by r.channel, r.address, r.contact_id
  on conflict on constraint messages_once do update
    set status = 'pending', attempts = 0, next_attempt_at = now(), lease_until = null
    where public.messages.status = 'cancelled' and public.messages.kind = 'heads_up'
$$;

create or replace function public.move_deadline(
  p_id uuid, p_deadline timestamptz,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
  v_told jsonb;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage not in ('active', 'overdue') then
    return 'wrong_stage';
  end if;
  if p_deadline = a.deadline then
    return null;
  end if;
  if p_deadline < a.deadline then
    return 'deadline_not_later';
  end if;
  if p_deadline <= now() then
    return 'deadline_not_in_future';
  end if;

  update public.adventures
     set stage = 'active', deadline = p_deadline, deadline_set_at = now(), updated_at = now()
   where id = a.id;
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending'
     and kind in ('reminder', 'overdue_notice') and for_deadline <> p_deadline;

  -- A Deadline Update not yet attempted gives way to a new one that keeps its earlier time.
  with dropped as (
    delete from public.messages
     where adventure_id = a.id and kind = 'deadline_update' and status = 'pending' and attempts = 0
    returning channel, to_address, previous_deadline
  )
  select coalesce(jsonb_agg(to_jsonb(dropped)), '[]') into v_told from dropped;

  perform private.enqueue_to_contacts(a.id, 'deadline_update', null, null, a.deadline);
  -- Only contacts whose Heads-up already went out: an unsent Heads-up carries the new Deadline itself.
  delete from public.messages m
   where m.adventure_id = a.id and m.kind = 'deadline_update' and m.previous_deadline = a.deadline
     and not exists (
       select 1 from public.messages h
       where h.adventure_id = a.id and h.kind = 'heads_up' and h.contact_id = m.contact_id
         and h.status in ('sent', 'failed'));
  update public.messages m
     set previous_deadline = (t ->> 'previous_deadline')::timestamptz
    from jsonb_array_elements(v_told) t
   where m.adventure_id = a.id and m.kind = 'deadline_update' and m.previous_deadline = a.deadline
     and m.channel::text = t ->> 'channel' and m.to_address = t ->> 'to_address';
  update public.messages
     set next_attempt_at = now() + private.deadline_update_delay()
   where adventure_id = a.id and kind = 'deadline_update' and status = 'pending' and attempts = 0;

  perform private.record_position(a.id, 'deadline_move', p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
  perform private.reconcile(a.id);
  return null;
end $$;

create or replace function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')
returns setof public.messages language plpgsql security definer set search_path = '' as $$
begin
  -- A command cancels what it makes stale, but a row that was being sent at that moment can
  -- come back as a retry afterwards. Never an Alert: only check_in decides about those.
  update public.messages m set status = 'cancelled'
    from public.adventures a
   where a.id = m.adventure_id and m.status = 'pending' and (
         (m.kind in ('heads_up', 'plan_update', 'deadline_update') and (a.stage = 'ended' or not exists (
            select 1 from public.adventure_contacts ac
            where ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id)))
      or (m.kind = 'deadline_update' and a.stage = 'alerted')
      or (m.kind in ('reminder', 'overdue_notice') and (a.stage = 'ended' or m.for_deadline <> a.deadline)));

  update public.messages set status = 'failed', failure_reason = 'retries_exhausted', lease_until = null
   where status = 'sending' and lease_until < now() and attempts >= private.max_attempts();

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

create or replace function public.message_facts(p_message_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'kind', m.kind,
           'adventurer_name', p.name,
           'contact_name', c.name,
           'time_zone', a.time_zone,
           'language', coalesce(p.message_language, 'en'),
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route,
                                      'starting_point', a.starting_point, 'notes', a.notes),
           'deadline', coalesce(m.for_deadline, a.deadline))
         || case m.kind
              when 'heads_up' then jsonb_build_object('trail_token', ac.trail_token)
              when 'plan_update' then jsonb_build_object('trail_token', ac.trail_token)
              when 'deadline_update' then jsonb_build_object('trail_token', ac.trail_token,
                                                             'previous_deadline', m.previous_deadline)
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

create or replace view public.delivery_failures with (security_invoker = true) as
  select m.id, m.adventure_id, m.kind, m.channel, m.to_address, m.contact_id,
         c.name as contact_name, m.round, m.failure_reason, m.created_at
  from public.messages m
  left join public.emergency_contacts c on c.id = m.contact_id
  where m.status = 'failed' and m.kind in ('heads_up', 'plan_update', 'deadline_update', 'alert', 'all_clear');
