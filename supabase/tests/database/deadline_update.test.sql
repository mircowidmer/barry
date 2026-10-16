begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000000');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com');

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Grosser Mythen',
   date_trunc('minute', now()) + interval '2 hours', now(), 'Europe/Zurich', now());

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');

-- Luca's Heads-up went out, Mia's is still on its way.
insert into public.messages (adventure_id, kind, channel, to_address, contact_id, status, attempts) values
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1),
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'mia@example.com', 'aaaaaaaa-0000-0000-0000-000000000002', 'pending', 0);

create function pg_temp.deadline() returns timestamptz language sql as $$
  select deadline from public.adventures where id = 'a0000000-0000-0000-0000-000000000001'
$$;

create temp table times as select pg_temp.deadline() as first_deadline;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(public.move_deadline('a0000000-0000-0000-0000-000000000001', pg_temp.deadline() + interval '1 hour'), null, 'The Deadline moves');

reset role;

select is(
  (select count(*)::int from public.messages where kind = 'deadline_update' and to_address = 'luca@example.com' and status = 'pending'),
  1,
  'Luca, whose Heads-up went out, gets a Deadline Update'
);
select is(
  (select count(*)::int from public.messages where kind = 'deadline_update' and to_address = 'mia@example.com'),
  0,
  'Mia gets none: her Heads-up is still on its way and carries the new Deadline itself'
);
select is(
  (select (previous_deadline = (select first_deadline from times))
          and next_attempt_at between now() + interval '2 minutes 59 seconds' and now() + interval '3 minutes 1 second'
   from public.messages where kind = 'deadline_update'),
  true,
  'The Deadline Update remembers the earlier Deadline and waits three minutes'
);
select is(
  public.message_facts((select id from public.messages where kind = 'deadline_update'))
    - 'contact_name' - 'plan' - 'adventurer_name' - 'time_zone' - 'language' - 'trail_token' - 'kind',
  jsonb_build_object('deadline', pg_temp.deadline(), 'previous_deadline', (select first_deadline from times)),
  'message_facts gives the new Deadline and the earlier one'
);

set local role authenticated;
select public.move_deadline('a0000000-0000-0000-0000-000000000001', pg_temp.deadline() + interval '1 hour');
reset role;

select is(
  (select count(*)::int || ' ' || bool_and(previous_deadline = (select first_deadline from times))
   from public.messages where kind = 'deadline_update'),
  '1 true',
  'A second move before the first update went out leaves one Deadline Update, still from the first Deadline'
);

update public.messages set status = 'sent', attempts = 1 where kind = 'deadline_update';
create temp table told as select pg_temp.deadline() as told_deadline;

set local role authenticated;
select public.move_deadline('a0000000-0000-0000-0000-000000000001', pg_temp.deadline() + interval '1 hour');
reset role;

select is(
  (select previous_deadline from public.messages where kind = 'deadline_update' and status = 'pending'),
  (select told_deadline from told),
  'After an update went out, the next one starts from the Deadline Luca was last told'
);

update public.adventures set stage = 'alerted', alerts_sent = 1, last_alert_at = now() where id = 'a0000000-0000-0000-0000-000000000001';
update public.messages set next_attempt_at = now() where kind = 'deadline_update' and status = 'pending';
select count(*) from public.claim_messages(10);

select is(
  (select status::text from public.messages where kind = 'deadline_update' and previous_deadline = (select told_deadline from told)),
  'cancelled',
  'A Deadline Update still waiting when the Alert goes out is cancelled'
);

select is(
  (select count(*)::int from public.delivery_failures where kind = 'deadline_update'),
  0,
  'The cancelled update is no Delivery Failure'
);

select * from finish();
rollback;
