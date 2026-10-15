create type public.refusal as enum (
  'not_found',
  'profile_incomplete',
  'destination_missing',
  'deadline_missing',
  'deadline_not_in_future',
  'deadline_not_later',
  'no_contacts',
  'unknown_contact',
  'another_adventure_in_progress',
  'wrong_stage',
  'invalid_time_zone'
);

-- The addresses whose Alert may have reached them: sent, in flight, or retrying after an
-- attempt that may have been delivered before it timed out.
create function private.enqueue_all_clear(p_adventure_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.messages (adventure_id, kind, channel, to_address, contact_id)
  select distinct m.adventure_id, 'all_clear'::public.message_kind, m.channel, m.to_address, m.contact_id
  from public.messages m
  where m.adventure_id = p_adventure_id and m.kind = 'alert'
    and (m.status in ('sending', 'sent') or (m.status = 'pending' and m.attempts > 0))
  on conflict on constraint messages_once do nothing
$$;

create function private.record_position(
  p_adventure_id uuid, p_reason text, p_latitude double precision, p_longitude double precision,
  p_accuracy_m real, p_taken_at timestamptz
) returns void language sql security definer set search_path = '' as $$
  insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason)
  select p_adventure_id, coalesce(p_taken_at, now()), p_latitude, p_longitude, p_accuracy_m, p_reason
  where p_latitude is not null and p_longitude is not null
$$;

create function public.save_adventure(
  p_id uuid, p_destination text, p_route text, p_starting_point text, p_notes text,
  p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_contacts uuid[] := coalesce(p_contact_ids, '{}');
  a public.adventures;
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

    update public.adventures
       set destination = p_destination, route = p_route, starting_point = p_starting_point, notes = p_notes,
           deadline = case when a.stage = 'planned' then p_deadline else deadline end,
           updated_at = now()
     where id = a.id
    returning * into a;
  end if;

  delete from public.adventure_contacts where adventure_id = a.id and contact_id <> all (v_contacts);
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending' and contact_id <> all (v_contacts);
  insert into public.adventure_contacts (adventure_id, contact_id)
  select a.id, unnest(v_contacts)
  on conflict do nothing;

  if a.stage <> 'planned' then
    perform private.reconcile(a.id);
  end if;

  return query select a.id, null::public.refusal;
end $$;

create function public.delete_adventure(p_id uuid) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage <> 'planned' then
    return 'wrong_stage';
  end if;
  delete from public.adventures where id = a.id;
  return null;
end $$;

create function public.start_adventure(
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
       set stage = 'active', started_at = now(), deadline_set_at = now(), time_zone = p_time_zone,
           updated_at = now()
     where id = a.id;
  exception when unique_violation then
    return 'another_adventure_in_progress';
  end;

  perform private.record_position(a.id, 'start', p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
  perform private.reconcile(a.id);
  return null;
end $$;

create function public.move_deadline(
  p_id uuid, p_deadline timestamptz,
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

  perform private.record_position(a.id, 'deadline_move', p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
  perform private.reconcile(a.id);
  return null;
end $$;

create function public.check_in(p_id uuid, p_checked_in_at timestamptz) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage = 'planned' then
    return 'wrong_stage';
  end if;
  if a.stage = 'ended' then
    return null;
  end if;

  update public.adventures
     set stage = 'ended', ended_at = now(), updated_at = now(),
         checked_in_at = least(now(), greatest(coalesce(p_checked_in_at, now()), started_at))
   where id = a.id;

  -- Under READ COMMITTED this waits for a row deliver has claimed, rereads it as 'sending' and
  -- leaves it, so an Alert already on its way is never cancelled.
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending'
     and not (kind = 'alert' and attempts > 0);

  if a.stage = 'alerted' then
    perform private.enqueue_all_clear(a.id);
  end if;
  return null;
end $$;

revoke execute on function public.save_adventure, public.delete_adventure, public.start_adventure,
  public.move_deadline, public.check_in from public, anon;
grant execute on function public.save_adventure, public.delete_adventure, public.start_adventure,
  public.move_deadline, public.check_in to authenticated;
