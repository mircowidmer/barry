begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Noah', 'noah@example.com');

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active',
   'Grosser Mythen', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'planned',
   null, null, null, null, null),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'planned',
   'Pilatus', null, null, null, null);

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');

insert into public.messages (adventure_id, kind, channel, to_address, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001');

-- Rules the tables enforce for everyone, including the clock.

select throws_ok(
  $$insert into public.adventures (adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at)
    values ('11111111-1111-1111-1111-111111111111', 'active', 'Rigi', '2026-10-18 18:00+02', '2026-10-18 08:00+02', 'Europe/Zurich', '2026-10-18 08:00+02')$$,
  '23505', null,
  'An Adventurer cannot have two in-progress Adventures'
);

select throws_ok(
  $$insert into public.adventures (adventurer_id, stage, started_at) values ('22222222-2222-2222-2222-222222222222', 'active', now())$$,
  '23514', null,
  'A started Adventure needs a destination, a Deadline and a time zone'
);

select throws_ok(
  $$update public.adventures set stage = 'alerted' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'An Alerted Adventure must have sent at least one Alert'
);

select is(
  (select alert_at from public.adventures where id = 'a0000000-0000-0000-0000-000000000001'),
  '2026-10-17 18:30+02'::timestamptz,
  'alert_at is the Deadline plus the Grace Period'
);

select throws_ok(
  $$insert into public.emergency_contacts (adventurer_id, name) values ('11111111-1111-1111-1111-111111111111', 'Nobody')$$,
  '23514', null,
  'An Emergency Contact needs a phone number or an email address'
);

-- The app, signed in as Anna.

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41791234567')$$,
  'Anna can create her own Profile'
);

select lives_ok(
  $$insert into public.emergency_contacts (name, phone) values ('Sara', '+41797654321')$$,
  'Anna can add an Emergency Contact'
);

select throws_ok(
  $$insert into public.emergency_contacts (adventurer_id, name, email) values ('22222222-2222-2222-2222-222222222222', 'Spy', 'spy@example.com')$$,
  '42501', null,
  'Anna cannot add a contact to Ben''s list'
);

select is(
  (select count(*)::int from public.emergency_contacts),
  3,
  'Anna sees only her own contacts'
);

select is(
  (select array_agg(id order by id) from public.adventures),
  array['a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002']::uuid[],
  'Anna sees only her own Adventures'
);

select is(
  (select count(*)::int from public.messages),
  1,
  'Anna can read the messages of her own Adventures'
);

select throws_ok(
  $$insert into public.adventures (adventurer_id, destination) values ('11111111-1111-1111-1111-111111111111', 'Rigi')$$,
  '42501', null,
  'The app cannot create an Adventure directly'
);

select throws_ok(
  $$update public.adventures set stage = 'ended' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'The app cannot change a Stage directly'
);

select throws_ok(
  $$insert into public.messages (adventure_id, kind, channel, to_address, contact_id)
    values ('a0000000-0000-0000-0000-000000000001', 'alert', 'email', 'x@example.com', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null,
  'The app cannot queue a message'
);

select throws_ok(
  $$select * from private.channel_config$$,
  '42501', null,
  'The app cannot reach the private schema'
);

select throws_ok(
  $$update public.emergency_contacts set removed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'P0001', 'barry:contact_in_use',
  'A contact of an Active Adventure cannot be removed'
);

select lives_ok(
  $$update public.emergency_contacts set removed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  'A contact that only a Planned Adventure uses can be removed'
);

reset role;

select is(
  (select count(*)::int from public.adventure_contacts where contact_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'The removed contact leaves the Planned Adventure'
);

select throws_ok(
  $$delete from auth.users where id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001', 'barry:adventure_in_progress',
  'An account with an Active Adventure cannot be deleted'
);

select * from finish();
rollback;
