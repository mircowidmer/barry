begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(44);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

insert into public.adventurer_profiles (id, name, phone) values
  ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000001'),
  ('22222222-2222-2222-2222-222222222222', 'Ben', '+41790000002');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Noah', 'noah@example.com');

insert into public.adventures (id, adventurer_id, stage, destination, route, deadline, deadline_set_at, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Rigi', 'North face',
   now() + interval '5 hours', now() - interval '1 hour', 'Europe/Zurich', now() - interval '1 hour');
insert into public.adventures (id, adventurer_id, destination) values
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Pilatus'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Titlis');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason) values
  ('a0000000-0000-0000-0000-000000000001', now() - interval '1 hour', 47.0, 8.6, 10, 'start'),
  ('b0000000-0000-0000-0000-000000000001', '2026-10-15T09:41:59.900Z', 46.8, 8.4, 5, 'start');

insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id, status, attempts) values
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', null, 'email', 'mia@example.com', 'aaaaaaaa-0000-0000-0000-000000000002', 'sent', 1),
  ('a0000000-0000-0000-0000-000000000001', 'alert', 1, 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 1);

create temp table tokens (name text primary key, token text);
insert into tokens
  select c.name || ':' || ac.adventure_id, ac.trail_token
  from public.adventure_contacts ac join public.emergency_contacts c on c.id = ac.contact_id;
insert into tokens values ('unknown', 'AAAAAAAAAAAAAAAAAAAAAA');
grant select, insert, update on tokens to anon, authenticated;

create function pg_temp.map(p_name text) returns jsonb language sql as $$
  select public.trail_map((select token from tokens where name = p_name))
$$;
grant execute on function pg_temp.map to anon;

create function pg_temp.message(p_kind public.message_kind, p_address text) returns bigint language sql as $$
  select id from public.messages
  where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = p_kind and to_address = p_address
$$;

create function pg_temp.trail_count() returns int language sql as $$
  select count(*)::int from public.position_readings
  where adventure_id = 'a0000000-0000-0000-0000-000000000001' and reason = 'trail'
$$;

create function pg_temp.reading(p_at timestamptz, p_latitude double precision) returns jsonb language sql as $$
  select jsonb_build_object('taken_at', p_at, 'latitude', p_latitude, 'longitude', 8.6, 'accuracy_m', 12)
$$;

select is(length((select token from tokens where name = 'Luca:a0000000-0000-0000-0000-000000000001')), 22,
  'A Trail Map link token is 22 URL-safe characters');
select isnt((select token from tokens where name = 'Luca:a0000000-0000-0000-0000-000000000001'),
  (select token from tokens where name = 'Mia:a0000000-0000-0000-0000-000000000001'),
  'Each contact of an Adventure gets their own link');
select is((select slot from public.position_readings where adventure_id = 'b0000000-0000-0000-0000-000000000001'),
  '2026-10-15T09:41:50Z'::timestamptz,
  'The slot of 2026-10-15T09:41:59.900Z is 2026-10-15T09:41:50 in UTC');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table batch as
  select jsonb_build_array(
    pg_temp.reading(date_trunc('minute', now()) - interval '50 minutes', 47.01),
    pg_temp.reading(date_trunc('minute', now()) - interval '49 minutes', 47.02),
    pg_temp.reading(date_trunc('minute', now()) - interval '48 minutes', 47.03)) as readings;

select is(public.record_trail('a0000000-0000-0000-0000-000000000001', (select readings from batch)), null,
  'Anna records Trail readings on her Active Adventure');
select is(pg_temp.trail_count(), 3, 'Each reading is stored as a Trail reading');
select is(public.record_trail('a0000000-0000-0000-0000-000000000001', (select readings from batch)), null,
  'The same batch again is accepted');
select is(pg_temp.trail_count(), 3, 'The same batch again stores nothing new');

select is(public.record_trail('a0000000-0000-0000-0000-000000000001', jsonb_build_array(
    pg_temp.reading(date_trunc('minute', now()) - interval '30 minutes' + interval '18 seconds', 47.05),
    pg_temp.reading(date_trunc('minute', now()) - interval '30 minutes' + interval '12 seconds', 47.04))), null,
  'Two readings in one 10-second window are accepted');
select is(
  (select array_agg(latitude) from public.position_readings
   where adventure_id = 'a0000000-0000-0000-0000-000000000001' and reason = 'trail'
     and slot = date_trunc('minute', now()) - interval '30 minutes' + interval '10 seconds'),
  array[47.04::double precision],
  'Two readings in one 10-second window store the first');

select is(public.record_trail('a0000000-0000-0000-0000-000000000001', jsonb_build_array(
    pg_temp.reading(now() - interval '2 hours', 47.1),
    pg_temp.reading(now() + interval '10 minutes', 47.2),
    pg_temp.reading(date_trunc('minute', now()) - interval '20 minutes', 95),
    pg_temp.reading(date_trunc('minute', now()) - interval '10 minutes', 47.06))), null,
  'A batch with invalid readings is accepted');
select is(pg_temp.trail_count(), 5,
  'Readings before the Start, in the future or off the globe are dropped, and the rest are stored');

select is(public.move_deadline('a0000000-0000-0000-0000-000000000001', now() + interval '6 hours',
    47.07, 8.6, 8, date_trunc('minute', now()) - interval '10 minutes'), null,
  'Anna moves the Deadline');
select is(
  (select array_agg(reason order by reason) from public.position_readings
   where adventure_id = 'a0000000-0000-0000-0000-000000000001' and slot = date_trunc('minute', now()) - interval '10 minutes'),
  array['deadline_move', 'trail'],
  'A Deadline move in the same 10 seconds as a Trail reading stores both');

select is(public.record_trail('a0000000-0000-0000-0000-000000000002', (select readings from batch)), 'wrong_stage',
  'A Planned Adventure takes no Trail');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.record_trail('a0000000-0000-0000-0000-000000000001', (select readings from batch)), 'not_found',
  'Ben cannot record on Anna''s Adventure');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(pg_temp.map('unknown'), null, 'An unknown link shows nothing');
select is(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000002'), null, 'A Planned Adventure''s link shows nothing');
select is(
  pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') - 'trail' - 'last_known_position',
  jsonb_build_object('status', 'underway', 'adventurer_name', 'Anna', 'time_zone', 'Europe/Zurich',
    'plan', jsonb_build_object('destination', 'Rigi', 'route', 'North face')),
  'The Trail Map shows the name and the Plan, and no Deadline, Stage or Profile');
select is(jsonb_array_length(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') -> 'trail'), 7,
  'The Trail line holds the Start, the Trail and the Deadline-move readings');
select is(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') -> 'trail' -> 0 -> 0, '47.0'::jsonb,
  'The Trail line starts at the Start reading');
select is((pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') -> 'last_known_position' ->> 'latitude')::numeric, 47.06,
  'The Last Known Position is the newest reading');

reset role;

select is(public.message_facts(pg_temp.message('heads_up', 'mia@example.com')) ->> 'trail_token',
  (select token from tokens where name = 'Mia:a0000000-0000-0000-0000-000000000001'),
  'A Heads-up carries the contact''s own link token');
select is(public.message_facts(pg_temp.message('alert', 'luca@example.com')) ->> 'trail_token',
  (select token from tokens where name = 'Luca:a0000000-0000-0000-0000-000000000001'),
  'An Alert carries the contact''s own link token');
select is((public.message_facts(pg_temp.message('alert', 'luca@example.com'))
    -> 'last_known_position' ->> 'latitude')::numeric, 47.06,
  'An Alert carries the newest Trail reading');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select refusal from public.save_adventure('a0000000-0000-0000-0000-000000000001', 'Rigi', 'North face', null,
    array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[])), null,
  'Anna removes Mia from the Adventure');
reset role;
select is(public.message_facts(pg_temp.message('heads_up', 'mia@example.com')) -> 'trail_token',
  'null'::jsonb,
  'A message to a removed contact carries no link token');
set local role authenticated;
select is((select refusal from public.save_adventure('a0000000-0000-0000-0000-000000000001', 'Rigi', 'North face', null,
    array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[])), null,
  'Anna adds Mia again');
reset role;
insert into tokens
  select 'Mia again', trail_token from public.adventure_contacts
  where adventure_id = 'a0000000-0000-0000-0000-000000000001' and contact_id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role anon;
select is(pg_temp.map('Mia:a0000000-0000-0000-0000-000000000001'), null, 'A removed contact''s link stops working');
select isnt((select token from tokens where name = 'Mia again'), (select token from tokens where name = 'Mia:a0000000-0000-0000-0000-000000000001'),
  'A contact added again gets a new link');
select is(pg_temp.map('Mia again') ->> 'adventurer_name', 'Anna', 'The new link works');

reset role;
update public.adventures set stage = 'overdue' where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select is(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') ->> 'status', 'underway', 'An Overdue Adventure is shown as underway');

reset role;
update public.adventures set stage = 'alerted', alerts_sent = 1, last_alert_at = now()
 where id = 'a0000000-0000-0000-0000-000000000001';
set local role anon;
select is(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') ->> 'status', 'alerted', 'An Alerted Adventure is shown as alerted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.record_trail('a0000000-0000-0000-0000-000000000001', jsonb_build_array(
    pg_temp.reading(date_trunc('minute', now()) - interval '5 minutes', 47.08))), null,
  'An Alerted Adventure takes Trail readings');
select is(pg_temp.trail_count(), 6, 'The Alerted Trail reading is stored');

select is(public.check_in('a0000000-0000-0000-0000-000000000001', now()), null, 'Anna checks in');
select is(public.check_in('a0000000-0000-0000-0000-000000000001', now()), null, 'A resent Check-in is accepted');
select is(
  (select array_agg(reason order by reason) from public.position_readings where adventure_id = 'a0000000-0000-0000-0000-000000000001'),
  array['deadline_move', 'start', 'trail', 'trail', 'trail', 'trail', 'trail', 'trail'],
  'The Check-in keeps the Start, Deadline-move and Trail readings');
select is(public.record_trail('a0000000-0000-0000-0000-000000000001', (select readings from batch)), 'wrong_stage',
  'A Trail reading after the Check-in is refused');
select is(pg_temp.trail_count(), 6, 'A Trail reading after the Check-in stores nothing');

set local role anon;
select is(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') ->> 'status', 'checked_in',
  'After the Check-in the Trail Map says Anna checked in');
select is(jsonb_array_length(pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') -> 'trail'), 8,
  'After the Check-in the Trail Map keeps every reading up to the Check-in');
select is((pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') -> 'last_known_position' ->> 'latitude')::numeric, 47.08,
  'After the Check-in the Trail Map keeps the Last Known Position');
select is((pg_temp.map('Luca:a0000000-0000-0000-0000-000000000001') ->> 'checked_in_at')::timestamptz, now(),
  'After the Check-in the Trail Map shows the Check-in time');

reset role;
select is((public.message_facts(pg_temp.message('alert', 'luca@example.com'))
    -> 'last_known_position' ->> 'latitude')::numeric, 47.08,
  'A late Alert retry after the Check-in carries the newest reading');

select * from finish();
rollback;
