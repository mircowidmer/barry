-- The unique index collapses Trail readings to one per 10-second UTC window instead of one per minute.
-- The phone still uploads only the first reading of each minute (src/lib/barry/trail-buffer.ts), so the
-- Trail keeps about one reading a minute, as the spec and the permission texts say. The finer slot only
-- lets a denser upload through without rejecting it.
drop index public.position_readings_trail_minute;
alter table public.position_readings drop column minute;
alter table public.position_readings
  add column slot timestamptz
    generated always as (date_bin('10 seconds', taken_at, timestamptz '2000-01-01 00:00:00+00')) stored;

create unique index position_readings_trail_slot
  on public.position_readings (adventure_id, slot) where reason = 'trail';

create or replace function public.record_trail(p_id uuid, p_readings jsonb) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  -- for share waits for check_in's for update, so no reading lands after the Trail delete,
  -- while two uploads never wait on each other.
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for share;
  if not found then
    return 'not_found';
  end if;
  if a.stage not in ('active', 'overdue', 'alerted') then
    return 'wrong_stage';
  end if;

  insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason)
  select a.id, r.taken_at, r.latitude, r.longitude, r.accuracy_m, 'trail'
    from jsonb_to_recordset(p_readings)
         as r (taken_at timestamptz, latitude double precision, longitude double precision, accuracy_m real)
   where r.taken_at between a.started_at and now() + interval '2 minutes'
     and r.latitude between -90 and 90 and r.longitude between -180 and 180
     and (r.accuracy_m is null or r.accuracy_m >= 0)
   order by r.taken_at
   limit 500
  on conflict (adventure_id, slot) where reason = 'trail' do nothing;

  return null;
end $$;
