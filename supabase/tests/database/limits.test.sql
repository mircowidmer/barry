begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(16);

select is(private.max_contacts(), 10, 'an Adventurer keeps at most 10 Emergency Contacts');
select is(private.max_adventure_contacts(), 5, 'an Adventure has at most 5 contacts');
select is(private.max_starts_per_day(), 5, 'an Adventurer starts at most 5 Adventures in 24 hours');
select is(private.starts_window(), interval '24 hours', 'a Start counts towards the limit for 24 hours');

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name) values ('11111111-1111-1111-1111-111111111111', 'Anna');
insert into public.emergency_contacts (id, adventurer_id, name, email)
select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       '11111111-1111-1111-1111-111111111111', 'Contact ' || n, 'contact' || n || '@example.com'
from generate_series(1, 9) n;
insert into public.emergency_contacts (id, adventurer_id, name, email, removed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000099', '11111111-1111-1111-1111-111111111111', 'Old', 'old@example.com', now());

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.emergency_contacts (adventurer_id, name, email)
  values ('11111111-1111-1111-1111-111111111111', 'Tenth', 'tenth@example.com');
select throws_ok(
  $$insert into public.emergency_contacts (adventurer_id, name, email)
      values ('11111111-1111-1111-1111-111111111111', 'Eleventh', 'eleventh@example.com')$$,
  'P0001', 'barry:too_many_contacts', 'an eleventh Emergency Contact is refused');
select throws_ok(
  $$update public.emergency_contacts set removed_at = null where id = 'aaaaaaaa-0000-0000-0000-000000000099'$$,
  'P0001', 'barry:too_many_contacts', 'a removed contact cannot come back past the limit');
select throws_ok(
  $$update public.emergency_contacts set name = repeat('N', 101) where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', null, 'a contact name longer than 100 characters is refused');
select throws_ok(
  $$update public.emergency_contacts set email = repeat('e', 243) || '@example.com' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', null, 'a contact email longer than 254 characters is refused');
select throws_ok(
  $$update public.adventurer_profiles set medical_notes = repeat('m', 501)$$,
  '23514', null, 'medical notes longer than 500 characters are refused');

select is(
  (select refusal from public.save_adventure(null, 'Rigi', now() + interval '8 hours',
     array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003',
           'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000006']::uuid[])),
  'too_many_contacts'::public.refusal, 'save_adventure refuses a sixth contact');
select throws_ok(
  $$select * from public.save_adventure(null, repeat('R', 201), now() + interval '8 hours',
      array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[])$$,
  '23514', null, 'a destination longer than 200 characters is refused');

create temporary table five on commit drop as
select adventure_id from public.save_adventure(null, 'Rigi', now() + interval '8 hours',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003',
        'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000005']::uuid[]);

reset role;
insert into private.starts (adventurer_id, started_at)
select '11111111-1111-1111-1111-111111111111'::uuid, now() - interval '25 hours'
union all
select '11111111-1111-1111-1111-111111111111'::uuid, now() - interval '1 hour' * n from generate_series(1, 4) n;
set local role authenticated;

select is(public.start_adventure((select adventure_id from five), 'Europe/Zurich'), null::public.refusal,
  'a fifth Start in 24 hours goes through, and one from 25 hours ago does not count');
select public.check_in((select adventure_id from five), null);
reset role;
select is((select count(*)::int from private.starts where adventurer_id = '11111111-1111-1111-1111-111111111111'), 5,
  'a Start drops the Adventurer''s Starts older than 24 hours');
set local role authenticated;

create temporary table sixth on commit drop as
select adventure_id from public.save_adventure(null, 'Pilatus', now() + interval '8 hours',
  array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);
select is(public.start_adventure((select adventure_id from sixth), 'Europe/Zurich'), 'too_many_starts'::public.refusal,
  'a sixth Start in 24 hours is refused');

reset role;
insert into public.adventures (id, adventurer_id, stage, destination, deadline, time_zone, started_at, alerts_sent, last_alert_at)
  values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'alerted', 'Titlis',
          now() - interval '1 hour', 'Europe/Zurich', now() - interval '5 hours', 1, now());
update public.messages set status = 'cancelled' where status in ('pending', 'sending');
insert into public.messages (adventure_id, kind, channel, to_address, contact_id) values
  ('b0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'first@example.com', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id) values
  ('b0000000-0000-0000-0000-000000000001', 'alert', 1, 'email', 'second@example.com', 'aaaaaaaa-0000-0000-0000-000000000002');
select is((select kind from public.claim_messages(1)), 'alert'::public.message_kind,
  'an Alert is claimed before an older message of another kind');

-- A destination saved before the limits, written past the triggers as an old row would be.
set local session_replication_role = replica;
update public.adventures set destination = repeat('L', 300) where id = 'b0000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
select lives_ok(
  $$update public.adventures set updated_at = now() where id = 'b0000000-0000-0000-0000-000000000001'$$,
  'an Adventure saved before the limits with a longer destination still updates');

select * from finish();
rollback;
