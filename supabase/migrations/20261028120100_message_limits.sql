-- One account could make Barry send any number of messages, with any text, to any address: costs on the
-- text message provider, spam from Barry's sender, and a queue that made other Adventurers' Alerts wait.
-- These limits bound what one account can send, and Alerts no longer queue behind other messages.

create function private.max_contacts() returns int language sql immutable set search_path = '' as $$ select 10 $$;
create function private.max_adventure_contacts() returns int language sql immutable set search_path = '' as $$ select 5 $$;
create function private.max_starts_per_day() returns int language sql immutable set search_path = '' as $$ select 5 $$;

-- not valid: rows saved before the limits stay as they are, every new write is checked.
alter table public.adventures add constraint destination_length check (length(destination) <= 200) not valid;
alter table public.adventurer_profiles
  add constraint name_length check (length(name) <= 100) not valid,
  add constraint car_make_length check (length(car_make) <= 50) not valid,
  add constraint car_colour_length check (length(car_colour) <= 50) not valid,
  add constraint car_plate_length check (length(car_plate) <= 20) not valid,
  add constraint medical_notes_length check (length(medical_notes) <= 500) not valid;
alter table public.emergency_contacts
  add constraint name_length check (length(name) <= 100) not valid,
  add constraint email_length check (length(email) <= 254) not valid;

create table private.starts (
  adventurer_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);
create index on private.starts (adventurer_id, started_at);

create function private.guard_contact_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.removed_at is null and (tg_op = 'INSERT' or old.removed_at is not null) and (
    select count(*) from public.emergency_contacts
    where adventurer_id = new.adventurer_id and removed_at is null and id <> new.id
  ) >= private.max_contacts() then
    raise exception 'barry:too_many_contacts' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger guard_contact_count before insert or update of removed_at on public.emergency_contacts
  for each row execute function private.guard_contact_count();

create or replace function commands.save_adventure(
  p_id uuid, p_destination text, p_deadline timestamptz, p_contact_ids uuid[],
  p_destination_point jsonb default null
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_contacts uuid[] := coalesce(p_contact_ids, '{}');
  a public.adventures;
  v_plan_changed boolean := false;
  v_latitude double precision := (p_destination_point ->> 'latitude')::double precision;
  v_longitude double precision := (p_destination_point ->> 'longitude')::double precision;
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
  if (select count(distinct id) from unnest(v_contacts) as wanted (id)) > private.max_adventure_contacts() then
    return query select p_id, 'too_many_contacts'::public.refusal;
    return;
  end if;

  if p_id is null then
    insert into public.adventures (adventurer_id, destination, destination_latitude, destination_longitude, deadline)
    values (v_uid, p_destination, v_latitude, v_longitude, p_deadline)
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
      and a.destination is distinct from p_destination;

    update public.adventures
       set destination = p_destination,
           destination_latitude = v_latitude, destination_longitude = v_longitude,
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
  -- Counted from their own log, so deleting Ended Adventures does not reset it.
  if (select count(*) from private.starts s
      where s.adventurer_id = a.adventurer_id and s.started_at > now() - interval '24 hours') >= private.max_starts_per_day() then
    return 'too_many_starts';
  end if;

  begin
    update public.adventures
       set stage = 'active', started_at = now(), time_zone = p_time_zone,
           updated_at = now()
     where id = a.id;
  exception when unique_violation then
    return 'another_adventure_in_progress';
  end;

  insert into private.starts (adventurer_id) values (a.adventurer_id);
  perform private.record_position(a.id, 'start', p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
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
  -- All-clear waits for every Alert. Nothing else blocks, so an Alert overtakes a Heads-up in retry backoff,
  -- and Alerts are claimed first, so a flood of other messages cannot hold them back.
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
    order by m.kind = 'alert' desc, m.id
    limit p_limit
    for update skip locked
  )
  update public.messages m
     set status = 'sending', lease_until = now() + p_lease, attempts = m.attempts + 1
    from due
   where m.id = due.id
  returning m.*;
end $$;
