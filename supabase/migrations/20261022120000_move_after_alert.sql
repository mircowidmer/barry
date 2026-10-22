-- The Adventurer can move the Deadline of an Alerted Adventure into the future. It becomes Active
-- again, and when the new Deadline passes the contacts get up to three Alerts for it, an hour apart,
-- just like for the first one.
--
-- alerts_sent counts the Alerts for the current Deadline and drives the clock, so a move starts it
-- over. earlier_alerts keeps the Alerts for the Deadlines moved past, so the History still counts
-- them all. Each Alert carries the Deadline it is for, so round 1 for a new Deadline is a new
-- message, not a repeat of the old one.

alter table public.adventures add column earlier_alerts smallint not null default 0
  check (earlier_alerts >= 0);

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) =
        'CHECK (((kind = ANY (ARRAY[''reminder''::message_kind, ''overdue_notice''::message_kind])) = (for_deadline IS NOT NULL)))'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end $$;

-- Until now no Deadline moved after an Alert, so every Alert was for the current Deadline.
update public.messages m set for_deadline = a.deadline
  from public.adventures a
 where a.id = m.adventure_id and m.kind = 'alert';
alter table public.messages
  add check ((kind in ('reminder', 'overdue_notice', 'alert')) = (for_deadline is not null));

-- An Alert is for the Deadline the Adventure has when the Alert is enqueued.
create function private.alert_for_deadline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'alert' and new.for_deadline is null then
    new.for_deadline := (select deadline from public.adventures where id = new.adventure_id);
  end if;
  return new;
end $$;

create trigger alert_for_deadline before insert on public.messages
  for each row execute function private.alert_for_deadline();

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
