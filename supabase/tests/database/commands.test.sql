begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(64);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

insert into public.adventurer_profiles (id, name, phone) values
  ('22222222-2222-2222-2222-222222222222', 'Ben', '+41790000002');

insert into public.emergency_contacts (id, adventurer_id, name, email, removed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Old', 'old@example.com', now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Noah', 'noah@example.com', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Olga', 'olga@example.com', null),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Paul', 'paul@example.com', null);

insert into public.adventures (id, adventurer_id, destination, deadline) values
  ('a0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', null,             now() + interval '8 hours'),
  ('a0000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Rigi',           null),
  ('a0000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'Rigi',           now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'Rigi',           now() + interval '8 hours'),
  ('a0000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'Grosser Mythen', now() + interval '8 hours'),
  ('a0000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'Pilatus',        now() + interval '9 hours');

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone,
                               started_at, alerts_sent, last_alert_at) values
  ('b0000000-0000-0000-0000-000000000021', '22222222-2222-2222-2222-222222222222', 'alerted', 'Titlis',
   now() - interval '3 hours', now() - interval '10 hours', 'Europe/Zurich',
   now() - interval '10 hours', 1, now() - interval '150 minutes');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000003');

insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id, status, attempts) values
  ('b0000000-0000-0000-0000-000000000021', 'alert', 1, 'email', 'noah@example.com', 'bbbbbbbb-0000-0000-0000-000000000001', 'sent', 1),
  ('b0000000-0000-0000-0000-000000000021', 'alert', 1, 'email', 'olga@example.com', 'bbbbbbbb-0000-0000-0000-000000000002', 'pending', 0),
  ('b0000000-0000-0000-0000-000000000021', 'alert', 1, 'email', 'paul@example.com', 'bbbbbbbb-0000-0000-0000-000000000003', 'pending', 1);

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone,
                               started_at, checked_in_at, ended_at) values
  ('c0000000-0000-0000-0000-000000000031', '11111111-1111-1111-1111-111111111111', 'ended', 'Säntis',
   now() - interval '20 days', now() - interval '21 days', 'Europe/Zurich',
   now() - interval '21 days', now() - interval '20 days', now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000032', '11111111-1111-1111-1111-111111111111', 'ended', 'Eiger',
   now() - interval '2 hours', now() - interval '10 hours', 'Europe/Zurich',
   now() - interval '10 hours', now() - interval '5 minutes', now() - interval '5 minutes'),
  ('c0000000-0000-0000-0000-000000000033', '11111111-1111-1111-1111-111111111111', 'ended', 'Mönch',
   now() - interval '2 hours', now() - interval '10 hours', 'Europe/Zurich',
   now() - interval '10 hours', now() - interval '5 minutes', now() - interval '5 minutes');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('c0000000-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000033', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.position_readings (adventure_id, taken_at, latitude, longitude, reason) values
  ('c0000000-0000-0000-0000-000000000031', now() - interval '21 days', 47.25, 9.34, 'start');

insert into public.messages (adventure_id, kind, channel, to_address, contact_id, status, attempts) values
  ('c0000000-0000-0000-0000-000000000031', 'heads_up', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1),
  ('c0000000-0000-0000-0000-000000000031', 'all_clear', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'failed', 3),
  ('c0000000-0000-0000-0000-000000000032', 'all_clear', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', 0),
  ('c0000000-0000-0000-0000-000000000033', 'all_clear', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sending', 1);

create function pg_temp.messages(p_adventure uuid, p_kind public.message_kind) returns text[]
language sql as $$
  select coalesce(array_agg(concat_ws(' ', to_address, status) order by to_address), '{}')
  from public.messages where adventure_id = p_adventure and kind = p_kind
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- save_adventure: create and edit a Planned Adventure

create temporary table created on commit drop as
  select * from public.save_adventure(null, 'Rigi', null, now() + interval '8 hours',
                                      array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);

select is((select refusal from created), null::public.refusal, 'save_adventure creates a Planned Adventure');
select is(
  (select stage from public.adventures where id = (select adventure_id from created)),
  'planned'::public.adventure_stage,
  'The new Adventure is Planned and belongs to Anna'
);
select is(
  (select array_agg(contact_id) from public.adventure_contacts where adventure_id = (select adventure_id from created)),
  array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[],
  'The new Adventure uses Luca'
);
select is(
  (select refusal from public.save_adventure(null, 'Rigi', null, null, array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[])),
  'unknown_contact'::public.refusal,
  'Anna cannot use Ben''s contact'
);
select is(
  (select refusal from public.save_adventure(null, 'Rigi', null, null, array['aaaaaaaa-0000-0000-0000-000000000003']::uuid[])),
  'unknown_contact'::public.refusal,
  'Anna cannot use a removed contact'
);
select is(
  (select refusal from public.save_adventure(null, null, null, null, '{}')),
  null::public.refusal,
  'A Planned Adventure can be saved without a destination, a Deadline or contacts'
);
select is(
  (select refusal from public.save_adventure(null, 'Rigi', null, 'Brunni car park', 'Bring a headlamp', null, '{}')),
  null::public.refusal,
  'An app that still sends a Starting Point and Notes can save its Plan'
);
create temporary table pinned on commit drop as
  select * from public.save_adventure(null, 'Pilatus', null, null, '{}', '{"latitude": 46.9786, "longitude": 8.2547}');
select is(
  (select array[destination_latitude, destination_longitude] from public.adventures
    where id = (select adventure_id from pinned)),
  array[46.9786, 8.2547]::double precision[],
  'save_adventure keeps the point of the destination on the map'
);
select throws_ok(
  $$select * from public.save_adventure(null, 'Pilatus', null, null, '{}', '{"latitude": 46.9786}')$$,
  '23514',
  null,
  'A point without its longitude is not saved'
);

-- start_adventure: every refusal, then a Start

select is(public.start_adventure('a0000000-0000-0000-0000-000000000015', 'Europe/Zurich'),
  'profile_incomplete'::public.refusal, 'Start needs a Profile');

insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000001');

select is(public.start_adventure('a0000000-0000-0000-0000-000000000011', 'Europe/Zurich'),
  'destination_missing'::public.refusal, 'Start needs a destination');
select is(public.start_adventure('a0000000-0000-0000-0000-000000000012', 'Europe/Zurich'),
  'deadline_missing'::public.refusal, 'Start needs a Deadline');
select is(public.start_adventure('a0000000-0000-0000-0000-000000000013', 'Europe/Zurich'),
  'deadline_not_in_future'::public.refusal, 'Start needs a Deadline in the future');
select is(public.start_adventure('a0000000-0000-0000-0000-000000000014', 'Europe/Zurich'),
  'no_contacts'::public.refusal, 'Start needs at least one contact');
select is(public.start_adventure('a0000000-0000-0000-0000-000000000015', 'Mars/Olympus'),
  'invalid_time_zone'::public.refusal, 'Start needs a real time zone');

select is(public.start_adventure('a0000000-0000-0000-0000-000000000015', 'Europe/Zurich', 47.03, 8.68, 12, null),
  null::public.refusal, 'Start succeeds');
select is(
  (select stage::text || ' ' || time_zone from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  'active Europe/Zurich',
  'The Adventure is Active in Anna''s time zone'
);
select is(
  (select deadline_set_at from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  now(),
  'Start records when the Deadline was set'
);
select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'heads_up'),
  array['luca@example.com pending'],
  'Start queues a Heads-up for Luca'
);
select is(
  (select array_agg(reason) from public.position_readings where adventure_id = 'a0000000-0000-0000-0000-000000000015'),
  array['start'],
  'Start records the Last Known Position'
);
select is(public.start_adventure('a0000000-0000-0000-0000-000000000015', 'Europe/Zurich'),
  null::public.refusal, 'Starting again is accepted, so a retry is safe');
select is(
  cardinality(pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'heads_up')),
  1,
  'Starting again queues no second Heads-up'
);
select is(public.start_adventure('a0000000-0000-0000-0000-000000000016', 'Europe/Zurich'),
  'another_adventure_in_progress'::public.refusal, 'Only one Adventure can be in progress');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.start_adventure('a0000000-0000-0000-0000-000000000016', 'Europe/Zurich'),
  'not_found'::public.refusal, 'Ben cannot start Anna''s Adventure');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- save_adventure while Active

select is(
  (select refusal from public.save_adventure('a0000000-0000-0000-0000-000000000015', 'Grosser Mythen', 'East ridge',
     now() + interval '20 hours',
     array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[])),
  null::public.refusal,
  'An Active Adventure accepts a Plan edit and a new contact'
);
select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'heads_up'),
  array['luca@example.com pending', 'mia@example.com pending'],
  'The added contact gets a Heads-up'
);
select is(
  (select deadline from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  now() + interval '8 hours',
  'Saving an Active Adventure leaves the Deadline alone'
);
select is(
  (select route from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  'East ridge',
  'Saving an Active Adventure updates the Plan'
);
select is(
  (select refusal from public.save_adventure('a0000000-0000-0000-0000-000000000015', 'Grosser Mythen', null, null, '{}')),
  'no_contacts'::public.refusal,
  'An Active Adventure keeps at least one contact'
);
select is(
  (select refusal from public.save_adventure('a0000000-0000-0000-0000-000000000015', 'Grosser Mythen', 'East ridge', null,
     array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[])),
  null::public.refusal,
  'A contact can be removed from an Active Adventure'
);
select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'heads_up'),
  array['luca@example.com pending', 'mia@example.com cancelled'],
  'The removed contact''s pending Heads-up is cancelled'
);

-- delete_adventure

select is(public.delete_adventure('a0000000-0000-0000-0000-000000000015'),
  'wrong_stage'::public.refusal, 'An Active Adventure cannot be deleted');
select is(public.delete_adventure('a0000000-0000-0000-0000-000000000016'),
  null::public.refusal, 'A Planned Adventure can be deleted');
select is(
  (select count(*)::int from public.adventures where id = 'a0000000-0000-0000-0000-000000000016'),
  0,
  'The deleted Adventure is gone'
);
select is(public.delete_adventure('c0000000-0000-0000-0000-000000000031'),
  null::public.refusal, 'An Ended Adventure whose messages are done can be deleted');
select is(
  (select count(*)::int from public.adventures where id = 'c0000000-0000-0000-0000-000000000031'),
  0,
  'The deleted Ended Adventure is gone'
);
reset role;
select is(
  (select count(*)::int from public.position_readings where adventure_id = 'c0000000-0000-0000-0000-000000000031'),
  0,
  'Its readings are gone'
);
select is(
  (select count(*)::int from public.adventure_contacts where adventure_id = 'c0000000-0000-0000-0000-000000000031'),
  0,
  'Its contacts are gone'
);
select is(
  (select count(*)::int from public.messages where adventure_id = 'c0000000-0000-0000-0000-000000000031'),
  0,
  'Its messages are gone'
);
set local role authenticated;
select is(public.delete_adventure('c0000000-0000-0000-0000-000000000032'),
  'messages_pending'::public.refusal, 'An Ended Adventure with a pending All-clear cannot be deleted');
select is(
  (select count(*)::int from public.adventures where id = 'c0000000-0000-0000-0000-000000000032'),
  1,
  'The Adventure with a pending All-clear still exists'
);
select is(public.delete_adventure('c0000000-0000-0000-0000-000000000033'),
  'messages_pending'::public.refusal, 'An Ended Adventure with an All-clear being sent cannot be deleted');
select is(
  (select count(*)::int from public.adventures where id = 'c0000000-0000-0000-0000-000000000033'),
  1,
  'The Adventure with an All-clear being sent still exists'
);
select is(public.delete_adventure('b0000000-0000-0000-0000-000000000021'),
  'not_found'::public.refusal, 'Anna cannot delete Ben''s Adventure');

-- move_deadline

select is(public.move_deadline('a0000000-0000-0000-0000-000000000015', now() + interval '7 hours'),
  'deadline_not_later'::public.refusal, 'The Deadline can only move later');
select is(public.move_deadline('a0000000-0000-0000-0000-000000000015', now() + interval '10 hours', 47.05, 8.70, 8, null),
  null::public.refusal, 'Moving the Deadline later succeeds');
select is(
  (select deadline from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  now() + interval '10 hours',
  'The new Deadline is stored'
);
select is(
  (select count(*)::int from public.position_readings where adventure_id = 'a0000000-0000-0000-0000-000000000015' and reason = 'deadline_move'),
  1,
  'The move records a new Last Known Position'
);
select is(public.move_deadline('a0000000-0000-0000-0000-000000000015', now() + interval '10 hours', 47.05, 8.70, 8, null),
  null::public.refusal, 'Sending the same move again is accepted');
select is(
  (select count(*)::int from public.position_readings where adventure_id = 'a0000000-0000-0000-0000-000000000015' and reason = 'deadline_move'),
  1,
  'The repeated move records nothing new'
);

reset role;
update public.adventures set stage = 'overdue', deadline = now() - interval '5 minutes'
  where id = 'a0000000-0000-0000-0000-000000000015';
insert into public.messages (adventure_id, kind, channel, to_address, for_deadline) values
  ('a0000000-0000-0000-0000-000000000015', 'overdue_notice', 'push', 'ExponentPushToken[anna]', now() - interval '5 minutes');
set local role authenticated;

select is(public.move_deadline('a0000000-0000-0000-0000-000000000015', now() + interval '1 hour'),
  null::public.refusal, 'An Overdue Adventure accepts a later Deadline');
select is(
  (select stage from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  'active'::public.adventure_stage,
  'Moving the Deadline makes an Overdue Adventure Active again'
);
select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'overdue_notice'),
  array['ExponentPushToken[anna] cancelled'],
  'The Overdue Notice for the old Deadline is cancelled'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is(public.move_deadline('b0000000-0000-0000-0000-000000000021', now() + interval '1 hour'),
  'wrong_stage'::public.refusal, 'An Alerted Adventure cannot move its Deadline');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- check_in

select is(public.check_in((select adventure_id from created), now()),
  'wrong_stage'::public.refusal, 'A Planned Adventure cannot be checked in from');

reset role;
insert into public.messages (adventure_id, kind, channel, to_address, for_deadline) values
  ('a0000000-0000-0000-0000-000000000015', 'reminder', 'push', 'ExponentPushToken[anna]', now() + interval '1 hour');
set local role authenticated;

select is(public.check_in('a0000000-0000-0000-0000-000000000015', now() + interval '1 hour'),
  null::public.refusal, 'Check-in from an Active Adventure succeeds');
select is(
  (select stage::text || ' ' || (checked_in_at = now())::text from public.adventures where id = 'a0000000-0000-0000-0000-000000000015'),
  'ended true',
  'The Adventure is Ended, and a Check-in time in the future is clamped to now'
);
select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'all_clear'),
  array['luca@example.com pending'],
  'A Check-in before any Alert still sends the All-clear to every contact'
);
select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000015', 'reminder'),
  array['ExponentPushToken[anna] cancelled'],
  'The pending Reminder is cancelled'
);
select is(public.check_in('a0000000-0000-0000-0000-000000000015', now()),
  null::public.refusal, 'Checking in again is accepted, so the offline queue can resend');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(public.check_in('b0000000-0000-0000-0000-000000000021', now() - interval '30 days'),
  null::public.refusal, 'Check-in from an Alerted Adventure succeeds');
select is(
  (select checked_in_at = started_at from public.adventures where id = 'b0000000-0000-0000-0000-000000000021'),
  true,
  'A Check-in time before the Start is clamped to the Start'
);
select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000021', 'all_clear'),
  array['noah@example.com pending', 'olga@example.com pending', 'paul@example.com pending'],
  'The All-clear goes to every contact, also Olga, whose Alert was never attempted'
);
select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000021', 'alert'),
  array['noah@example.com sent', 'olga@example.com cancelled', 'paul@example.com pending'],
  'Olga''s unattempted Alert is cancelled, and Paul''s attempted Alert keeps retrying'
);

select * from finish();
rollback;
