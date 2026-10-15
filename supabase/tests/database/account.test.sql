begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(9);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'cleo@example.com');

insert into public.adventurer_profiles (id, name, phone) values
  ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000001'),
  ('22222222-2222-2222-2222-222222222222', 'Ben', '+41790000002'),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '+41790000003');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Noah', 'noah@example.com'),
  ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Olga', 'olga@example.com');

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at,
                               checked_in_at, ended_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ended', 'Rigi',
   now() - interval '1 day', now() - interval '2 days', 'Europe/Zurich', now() - interval '2 days',
   now() - interval '1 day', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'active', 'Titlis',
   now() + interval '5 hours', now(), 'Europe/Zurich', now(), null, null),
  ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'ended', 'Säntis',
   now() - interval '1 hour', now() - interval '5 hours', 'Europe/Zurich', now() - interval '5 hours',
   now() - interval '5 minutes', now() - interval '5 minutes');
insert into public.adventures (id, adventurer_id, destination) values
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Pilatus');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001');

insert into public.position_readings (adventure_id, taken_at, latitude, longitude, reason) values
  ('a0000000-0000-0000-0000-000000000001', now() - interval '2 days', 47.0, 8.6, 'start');

insert into public.messages (adventure_id, kind, channel, to_address, contact_id, status, attempts) values
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1),
  ('c0000000-0000-0000-0000-000000000001', 'all_clear', 'email', 'olga@example.com', 'cccccccc-0000-0000-0000-000000000001', 'pending', 0);

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true)
$$;

select is(has_function_privilege('anon', 'public.delete_account()', 'execute'), false,
  'Without an account nothing can be deleted');

set local role authenticated;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(public.delete_account(), 'adventure_in_progress'::public.refusal,
  'An account with an Adventure in progress is not deleted');

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(public.delete_account(), 'messages_pending'::public.refusal,
  'An account with an All-clear still on its way is not deleted');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.delete_account(), null::public.refusal, 'An account without an Adventure in progress is deleted');

reset role;

select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0,
  'The sign-in is gone');
select is(
  (select count(*)::int from public.adventurer_profiles where id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.emergency_contacts where adventurer_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*)::int from public.adventures where adventurer_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'The Profile, the contacts and every Adventure are gone');
select is(
  (select count(*)::int from public.position_readings where adventure_id = 'a0000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.messages where adventure_id = 'a0000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.adventure_contacts where adventure_id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'The Trail, the messages and the Trail Map links are gone');
select is((select count(*)::int from auth.users where id in ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')), 2,
  'The refused accounts are still there');
select is((select count(*)::int from public.adventures where adventurer_id = '22222222-2222-2222-2222-222222222222'), 1,
  'Other Adventurers keep their Adventures');

select * from finish();
rollback;
