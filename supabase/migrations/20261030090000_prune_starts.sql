-- private.starts kept every Start for good, so the times an Adventurer went out outlived the Ended Adventures they
-- deleted. Only Starts inside the window count towards the limit, so each Start now drops the Adventurer's older ones.

create function private.starts_window() returns interval language sql immutable set search_path = '' as $$
  select interval '24 hours'
$$;

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
  delete from private.starts s
   where s.adventurer_id = a.adventurer_id and s.started_at <= now() - private.starts_window();
  -- Counted from their own log, so deleting Ended Adventures does not reset it.
  if (select count(*) from private.starts s where s.adventurer_id = a.adventurer_id) >= private.max_starts_per_day() then
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
