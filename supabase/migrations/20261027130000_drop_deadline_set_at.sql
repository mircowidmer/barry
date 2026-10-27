-- deadline_set_at told the clock whether a Deadline was set early enough for a Reminder. The phone
-- schedules the Reminder itself now, so nothing reads it and Start and a Deadline move stop writing it.

create or replace function commands.start_adventure(
  p_id uuid, p_time_zone text,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage in ('active', 'overdue', 'alerted') then
    return null;
  end if;
  if a.stage = 'ended' then
    return 'wrong_stage';
  end if;

  if not exists (select 1 from public.adventurer_profiles where id = a.adventurer_id) then
    return 'profile_incomplete';
  end if;
  if coalesce(btrim(a.destination), '') = '' then
    return 'destination_missing';
  end if;
  if a.deadline is null then
    return 'deadline_missing';
  end if;
  if a.deadline <= now() then
    return 'deadline_not_in_future';
  end if;
  if not exists (select 1 from public.adventure_contacts where adventure_id = a.id) then
    return 'no_contacts';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    return 'invalid_time_zone';
  end if;
  if exists (
    select 1 from public.adventures
    where adventurer_id = a.adventurer_id and stage in ('active', 'overdue', 'alerted')
  ) then
    return 'another_adventure_in_progress';
  end if;

  begin
    update public.adventures
       set stage = 'active', started_at = now(), time_zone = p_time_zone,
           updated_at = now()
     where id = a.id;
  exception when unique_violation then
    return 'another_adventure_in_progress';
  end;

  perform private.record_position(a.id, 'start', p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
  perform private.reconcile(a.id);
  return null;
end $$;

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
     set stage = 'active', deadline = p_deadline, updated_at = now(),
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

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.adventures'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%deadline_set_at%'
  loop
    execute format('alter table public.adventures drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.adventures drop column deadline_set_at;

alter table public.adventures
  add check (stage = 'planned' or (deadline is not null and time_zone is not null and destination is not null));
