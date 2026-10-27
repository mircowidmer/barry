-- The Reminder and the Overdue Notice are local notifications the phone schedules itself
-- (src/lib/barry/alarms.ts). Supabase never pushes them, so their message kinds, the push enqueue
-- and the clock's decisions to owe them go. The push channel and push_devices stay for later.

delete from public.messages where kind in ('reminder', 'overdue_notice');

-- The clock decides only Stage changes and Alert rounds.
drop function private.enqueue_push(uuid, public.message_kind);
drop function private.decide(public.adventure_stage, timestamptz, timestamptz, smallint, timestamptz, timestamptz);
drop type private.clock_decision;

create type private.clock_decision as (
  next_stage  public.adventure_stage,
  alert_round smallint
);

create function private.decide(
  stage public.adventure_stage, deadline timestamptz,
  alerts_sent smallint, last_alert_at timestamptz, now timestamptz
) returns private.clock_decision
language sql immutable set search_path = '' as $$
  select case
    when stage = 'active' and now >= deadline then
      row('overdue', null)::private.clock_decision
    when stage = 'overdue' and now >= deadline + private.grace_period() then
      row('alerted', 1)::private.clock_decision
    when stage = 'alerted' and alerts_sent < private.max_alerts()
                           and now >= last_alert_at + private.alert_interval() then
      row(null, alerts_sent + 1)::private.clock_decision
    else
      row(null, null)::private.clock_decision
  end
$$;
revoke execute on function private.decide from public;

create or replace function private.reconcile(p_adventure_id uuid, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
  d private.clock_decision;
begin
  select * into a from public.adventures where id = p_adventure_id for update;
  if not found or a.stage not in ('active', 'overdue', 'alerted') then
    return;
  end if;

  perform private.enqueue_to_contacts(a.id, 'heads_up', null);

  -- Only a Stage change can make decide() owe more, so only a Stage change continues the loop.
  loop
    d := private.decide(a.stage, a.deadline, a.alerts_sent, a.last_alert_at, p_now);

    if d.next_stage is not null or d.alert_round is not null then
      update public.adventures
         set stage = coalesce(d.next_stage, stage),
             alerts_sent = coalesce(d.alert_round, alerts_sent),
             last_alert_at = case when d.alert_round is null then last_alert_at else p_now end,
             updated_at = p_now
       where id = a.id
      returning * into a;
    end if;

    if d.alert_round is not null then
      perform private.enqueue_to_contacts(a.id, 'alert', d.alert_round);
    end if;

    exit when d.next_stage is null;
  end loop;
end $$;

-- Nothing is owed before the Deadline any more, so the clock looks only at Adventures past it.
create or replace function private.tick(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select id from public.adventures
    where stage in ('active', 'overdue', 'alerted')
      and deadline <= p_now
      and not (stage = 'alerted' and alerts_sent >= private.max_alerts())
    for update skip locked
  loop
    begin
      perform private.reconcile(r.id, p_now);
    exception when others then
      insert into private.tick_error (at, adventure_id, sqlstate, message)
      values (p_now, r.id, sqlstate, sqlerrm);
    end;
  end loop;

  insert into private.clock_status (id, last_tick_at) values (true, p_now)
  on conflict (id) do update set last_tick_at = excluded.last_tick_at;

  perform private.kick_deliverer();
end $$;

drop function private.reminder_lead();

create or replace function commands.move_deadline(
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
  if a.stage not in ('active', 'overdue', 'alerted') then
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
     set stage = 'active', deadline = p_deadline, deadline_set_at = now(), updated_at = now(),
         earlier_alerts = earlier_alerts + alerts_sent, alerts_sent = 0, last_alert_at = null
   where id = a.id;

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
      or (m.kind = 'deadline_update' and a.stage = 'alerted'));

  update public.messages set status = 'failed', failure_reason = 'retries_exhausted', lease_until = null
   where status = 'sending' and lease_until < now() and attempts >= private.max_attempts();

  -- Per address: an Alert waits for every earlier one, also those for an earlier Deadline, and an
  -- All-clear waits for every Alert. Nothing else blocks, so an Alert overtakes a Heads-up in retry backoff.
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
               or (m.kind = 'alert' and e.kind = 'alert'
                   and (e.for_deadline, e.round) < (m.for_deadline, m.round))))
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
           'plan', jsonb_build_object('destination', a.destination),
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
              when 'all_clear' then jsonb_build_object('checked_in_at', a.checked_in_at, 'trail_token', ac.trail_token)
              else '{}'::jsonb
            end
  from public.messages m
  join public.adventures a on a.id = m.adventure_id
  left join public.adventurer_profiles p on p.id = a.adventurer_id
  left join public.emergency_contacts c on c.id = m.contact_id
  left join public.adventure_contacts ac on ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id
  where m.id = p_message_id
$$;

-- A value cannot be dropped from an enum, so the type is built again without the two kinds. Every
-- check that compares kind goes first and comes back afterwards, the two about the kinds changed.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%kind%'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end $$;

drop view public.delivery_failures;

alter type public.message_kind rename to message_kind_old;
create type public.message_kind as enum ('heads_up', 'alert', 'all_clear', 'plan_update', 'deadline_update');
alter table public.messages alter column kind type public.message_kind using kind::text::public.message_kind;

drop function private.enqueue_to_contacts(uuid, public.message_kind_old, smallint, integer, timestamptz);
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

drop type public.message_kind_old;

alter table public.messages
  add check ((kind = 'alert') = (round is not null)),
  add check ((kind = 'alert') = (for_deadline is not null)),
  add check ((kind = 'plan_update') = (plan_revision is not null)),
  add check ((kind = 'deadline_update') = (previous_deadline is not null)),
  add check (channel <> 'push');

-- Every kind left reaches a contact, so the view needs no list of kinds.
create view public.delivery_failures with (security_invoker = true) as
  select m.id, m.adventure_id, m.kind, m.channel, m.to_address, m.contact_id,
         c.name as contact_name, m.round, m.failure_reason, m.created_at
  from public.messages m
  left join public.emergency_contacts c on c.id = m.contact_id
  where m.status = 'failed';
grant select on public.delivery_failures to authenticated;
