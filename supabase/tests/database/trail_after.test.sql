begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(4);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000001');
insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com');
insert into public.adventures (id, adventurer_id, stage, destination, deadline, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Rigi',
   now() + interval '5 hours', 'Europe/Zurich', now() - interval '1 hour');
insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason) values
  ('a0000000-0000-0000-0000-000000000001', '2026-10-15T10:00:00Z', 47.00, 8.60, 10, 'start'),
  ('a0000000-0000-0000-0000-000000000001', '2026-10-15T10:00:10Z', 47.01, 8.61, 10, 'trail'),
  ('a0000000-0000-0000-0000-000000000001', '2026-10-15T10:00:20Z', 47.02, 8.62, 10, 'trail');

create temp table link as select trail_token as token from public.adventure_contacts
  where adventure_id = 'a0000000-0000-0000-0000-000000000001';
grant select on link to anon;

set local role anon;

select is(jsonb_array_length(public.trail_map((select token from link)) -> 'trail'), 3,
  'Without a time the Trail Map carries the whole Trail');
select is(public.trail_map((select token from link), '2026-10-15T10:00:10Z') -> 'trail',
  '[[47.02, 8.62, "2026-10-15T10:00:20+00:00"]]'::jsonb,
  'With a time it carries only the readings taken after it');
select is(public.trail_map((select token from link), '2026-10-15T10:00:20Z') -> 'trail', '[]'::jsonb,
  'Nothing new gives an empty Trail');
select is(
  public.trail_map((select token from link), '2026-10-15T10:00:20Z') - 'trail',
  public.trail_map((select token from link)) - 'trail',
  'The status, the Plan and the Last Position come with every answer');

select * from finish();
rollback;
