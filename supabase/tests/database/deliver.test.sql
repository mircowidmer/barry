begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(36);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone, car_make, car_colour, car_plate, medical_notes)
  values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000001', 'Subaru', 'red', 'SZ 12345', 'Type 1 diabetic');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com');

-- X is Alerted and Y is Ended.
insert into public.adventures (id, adventurer_id, stage, destination, route, deadline, deadline_set_at, time_zone,
                               started_at, alerts_sent, last_alert_at, checked_in_at, ended_at) values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'alerted', 'Grosser Mythen', 'East ridge',
   now() - interval '3 hours', now() - interval '10 hours', 'Europe/Zurich', now() - interval '10 hours', 1, now() - interval '150 minutes', null, null),
  ('a0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'ended', 'Pilatus', null,
   now() - interval '3 hours', now() - interval '10 hours', 'Europe/Zurich', now() - interval '10 hours', 1, now() - interval '150 minutes',
   now() - interval '1 hour', now() - interval '1 hour');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason) values
  ('a0000000-0000-0000-0000-00000000000a', now() - interval '10 hours', 47.00, 8.60, 20, 'start'),
  ('a0000000-0000-0000-0000-00000000000a', now() - interval '6 hours', 47.03, 8.68, 12, 'deadline_move');

insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id, for_deadline,
                             status, attempts, next_attempt_at, lease_until) values
  ('a0000000-0000-0000-0000-00000000000a', 'heads_up',  null, 'email', 'a@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 0, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'heads_up',  null, 'email', 'b@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 1, now() + interval '1 minute', null),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'c@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 1, now() + interval '1 minute', null),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     2,    'email', 'c@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 0, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'd@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 1, now() + interval '1 minute', null),
  ('a0000000-0000-0000-0000-00000000000a', 'all_clear', null, 'email', 'd@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 0, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'heads_up',  null, 'email', 'e@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 1, now() + interval '1 minute', null),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'e@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 0, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'f@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'sending', 2, now(), now() - interval '1 minute'),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'g@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'sending', 1, now(), now() + interval '1 minute'),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'h@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'sending', 6, now(), now() - interval '1 minute'),
  ('a0000000-0000-0000-0000-00000000000a', 'alert',     1,    'email', 'i@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'failed',  6, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'all_clear', null, 'email', 'i@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 0, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'heads_up',  null, 'email', 'mia@example.com', 'aaaaaaaa-0000-0000-0000-000000000002', null, 'pending', 1, now(), null),
  ('a0000000-0000-0000-0000-00000000000a', 'reminder',  null, 'push',  'ExponentPushToken[anna]', null, now() - interval '5 hours', 'pending', 1, now(), null),
  ('a0000000-0000-0000-0000-00000000000b', 'heads_up',  null, 'email', 'j@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 1, now(), null),
  ('a0000000-0000-0000-0000-00000000000b', 'alert',     1,    'email', 'k@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'pending', 1, now(), null);

create temporary table claimed on commit drop as select * from public.claim_messages(100);

create function pg_temp.status(p_address text, p_kind public.message_kind) returns text language sql as $$
  select string_agg(concat_ws(' ', status, failure_reason), ', ' order by round)
  from public.messages where to_address = p_address and kind = p_kind
$$;

-- claim_messages

select is(
  (select array_agg(to_address || ' ' || kind order by to_address, kind) from claimed),
  array['a@example.com heads_up', 'e@example.com alert', 'f@example.com alert', 'i@example.com all_clear', 'k@example.com alert'],
  'claim takes exactly the due rows that nothing ahead of them blocks'
);
select is(pg_temp.status('a@example.com', 'heads_up'), 'sending', 'A claimed row is sending');
select is(
  (select attempts::text || ' ' || (lease_until = now() + interval '2 minutes')::text from public.messages where to_address = 'a@example.com'),
  '1 true',
  'A claim counts the attempt and sets a two-minute lease'
);
select is((select count(*)::int from claimed where to_address = 'c@example.com'), 0,
  'Alert 2 waits while Alert 1 to the same address is in retry backoff');
select is(pg_temp.status('b@example.com', 'heads_up'), 'pending', 'A row in retry backoff is not claimed yet');
select is(pg_temp.status('d@example.com', 'all_clear'), 'pending', 'An All-clear waits until the Alert to its address is settled');
select is(pg_temp.status('e@example.com', 'alert'), 'sending', 'An Alert overtakes a Heads-up in retry backoff');
select is((select attempts from public.messages where to_address = 'f@example.com'), 3::smallint, 'An expired lease makes the row claimable again');
select is(pg_temp.status('g@example.com', 'alert'), 'sending', 'A row with a live lease is left alone');
select is((select count(*)::int from claimed where to_address = 'g@example.com'), 0, 'A row with a live lease is not claimed twice');
select is(pg_temp.status('h@example.com', 'alert'), 'failed retries_exhausted', 'An expired lease after the last attempt fails the row');
select is(pg_temp.status('i@example.com', 'all_clear'), 'sending', 'An All-clear goes out even when the Alert to its address failed');
select is(pg_temp.status('mia@example.com', 'heads_up'), 'cancelled', 'A Heads-up for a contact no longer on the Adventure is cancelled');
select is(pg_temp.status('ExponentPushToken[anna]', 'reminder'), 'cancelled', 'A Reminder for an old Deadline is cancelled');
select is(pg_temp.status('j@example.com', 'heads_up'), 'cancelled', 'A Heads-up retry after the Check-in is cancelled');
select is(pg_temp.status('k@example.com', 'alert'), 'sending', 'An Alert retry after the Check-in still goes out');

-- settle_message

select public.settle_message((select id from claimed where to_address = 'a@example.com'), 1::smallint, 'sent', 'mailpit-1');
select is(
  (select status::text || ' ' || provider_ref || ' ' || (sent_at = now())::text || ' ' || (lease_until is null)::text
     from public.messages where to_address = 'a@example.com'),
  'sent mailpit-1 true true',
  'sent records the provider reference and clears the lease'
);
select public.settle_message((select id from claimed where to_address = 'f@example.com'), 2::smallint, 'sent', 'late');
select is(pg_temp.status('f@example.com', 'alert'), 'sending', 'A late report for an earlier attempt is ignored');
select public.settle_message((select id from claimed where to_address = 'e@example.com'), 1::smallint, 'retry', null, 'smtp timeout');
select is(
  (select status::text || ' ' || (next_attempt_at = now() + interval '30 seconds')::text || ' ' || failure_reason
     from public.messages where to_address = 'e@example.com' and kind = 'alert'),
  'pending true smtp timeout',
  'The first retry waits 30 seconds'
);
select public.settle_message((select id from claimed where to_address = 'f@example.com'), 3::smallint, 'retry', null, null, interval '7 minutes');
select is(
  (select (next_attempt_at = now() + interval '7 minutes')::text from public.messages where to_address = 'f@example.com'),
  'true',
  'A provider''s retry-after wins over the backoff schedule'
);
update public.messages set status = 'sending', attempts = 6 where to_address = 'c@example.com' and round = 1;
select public.settle_message((select id from public.messages where to_address = 'c@example.com' and round = 1), 6::smallint, 'retry', null, 'smtp timeout');
select is(pg_temp.status('c@example.com', 'alert'), 'failed retries_exhausted, pending', 'A retry after the sixth attempt fails the row');
select public.settle_message((select id from claimed where to_address = 'k@example.com'), 2::smallint, 'failed', null, 'mailbox does not exist');
select is(pg_temp.status('k@example.com', 'alert'), 'failed mailbox does not exist', 'failed is final at once');

-- message_facts

create function pg_temp.facts(p_address text, p_kind public.message_kind) returns jsonb language sql as $$
  select public.message_facts(id) from public.messages where to_address = p_address and kind = p_kind and coalesce(round, 1) = 1
$$;

select is(
  pg_temp.facts('a@example.com', 'heads_up') - 'deadline' - 'trail_token',
  jsonb_build_object('kind', 'heads_up', 'adventurer_name', 'Anna', 'contact_name', 'Luca', 'time_zone', 'Europe/Zurich', 'language', 'en',
    'plan', jsonb_build_object('destination', 'Grosser Mythen', 'route', 'East ridge', 'starting_point', null, 'notes', null)),
  'A Heads-up carries the name, the Plan and the Deadline, and nothing from the Profile'
);
select is(
  pg_temp.facts('e@example.com', 'alert') -> 'profile',
  jsonb_build_object('phone', '+41790000001', 'car_make', 'Subaru', 'car_colour', 'red', 'car_plate', 'SZ 12345', 'medical_notes', 'Type 1 diabetic'),
  'An Alert carries the full Adventurer Profile'
);
select is(
  (pg_temp.facts('e@example.com', 'alert') -> 'last_known_position' ->> 'latitude')::numeric,
  47.03,
  'An Alert carries the latest position reading'
);
select is((pg_temp.facts('e@example.com', 'alert') ->> 'round')::int, 1, 'An Alert carries its round');
update public.adventurer_profiles set message_language = 'de';
select is(pg_temp.facts('e@example.com', 'alert') ->> 'language', 'de', 'A message carries the language the Adventurer chose');
update public.adventurer_profiles set message_language = 'en';
select is(
  (pg_temp.facts('i@example.com', 'all_clear') ->> 'checked_in_at') is null and (pg_temp.facts('i@example.com', 'all_clear') ? 'checked_in_at'),
  true,
  'An All-clear carries the Check-in time'
);
select is(
  (pg_temp.facts('ExponentPushToken[anna]', 'reminder') ? 'profile'),
  false,
  'A Reminder carries nothing from the Profile'
);

-- health

delete from private.clock_status;
delete from private.tick_error;

select is((select clock_ok from public.health()), false, 'Without a tick the clock is not healthy');
insert into private.clock_status values (true, now() - interval '30 seconds');
select is((select clock_ok from public.health()), true, 'A tick in the last two minutes is healthy');
insert into private.tick_error (at, adventure_id, message) values (now() - interval '1 minute', null, 'boom');
select is((select adventures_ok from public.health()), false, 'A recent tick error is not healthy');
select is((select outbox_ok from public.health()), true, 'Rows due less than five minutes ago are healthy');
update public.messages set next_attempt_at = now() - interval '6 minutes' where to_address = 'd@example.com' and kind = 'all_clear';
select is((select outbox_ok from public.health()), false, 'A row due more than five minutes ago is not healthy');

-- Waking deliver and access

select is(
  has_function_privilege('authenticated', 'public.claim_messages(integer, interval)', 'execute'),
  false,
  'The app cannot claim messages'
);

delete from vault.secrets where name in ('deliver_url', 'deliver_secret');
select vault.create_secret('http://deliver.test/functions/v1/deliver', 'deliver_url');
select vault.create_secret('test-secret', 'deliver_secret');
insert into public.messages (adventure_id, kind, channel, to_address, contact_id)
  values ('a0000000-0000-0000-0000-00000000000a', 'heads_up', 'email', 'new@example.com', 'aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from net.http_request_queue where url = 'http://deliver.test/functions/v1/deliver'),
  1,
  'A new message wakes deliver'
);

select * from finish();
rollback;
