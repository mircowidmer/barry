begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
delete from public.messages;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'marco@example.com');
insert into public.adventurer_profiles (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Anna'),
  ('22222222-2222-2222-2222-222222222222', 'Marco');
insert into public.emergency_contacts (id, adventurer_id, name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'family@example.com', '+41791111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Ben', 'Family@example.com', null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Sara', 'sara@example.com', null);
insert into public.adventures (id, adventurer_id, stage, destination, deadline, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Pilatus',
   now() + interval '3 hours', 'Europe/Zurich', now() - interval '1 hour');
-- Sara got the Heads-up and was then removed from the Adventure.
insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');

insert into public.messages (id, adventure_id, kind, plan_revision, channel, to_address, contact_id, status, failure_reason) overriding system value values
  (901, 'a0000000-0000-0000-0000-000000000001', 'heads_up', null, 'email', 'family@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', null),
  (902, 'a0000000-0000-0000-0000-000000000001', 'heads_up', null, 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', null),
  (903, 'a0000000-0000-0000-0000-000000000001', 'heads_up', null, 'email', 'sara@example.com', 'aaaaaaaa-0000-0000-0000-000000000003', 'failed', 'retries_exhausted'),
  (904, 'a0000000-0000-0000-0000-000000000001', 'plan_update', 1, 'email', 'family@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'pending', null),
  (905, 'a0000000-0000-0000-0000-000000000001', 'plan_update', 1, 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'cancelled', null);
update public.messages set delivered_at = settled_at + interval '1 minute' where id = 902;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select array_agg(id order by id) from public.adventure_messages),
  array[901, 902, 903]::bigint[],
  'The Adventurer sees the messages that went out and those that failed, not those waiting or cancelled'
);
select is(
  (select array_agg(c ->> 'name' order by c ->> 'name') from public.adventure_messages, jsonb_array_elements(contacts) c where id = 901),
  array['Ben', 'Luca'],
  'A message to an address two contacts share names both'
);
select is(
  (select contacts -> 0 ->> 'name' from public.adventure_messages where id = 903),
  'Sara',
  'A contact removed from the Adventure keeps the messages Barry sent them'
);
select is(
  (select delivered from public.adventure_messages where id = 902),
  true,
  'A text message Twilio confirmed is delivered'
);
select ok(
  (select outcome_at > (select settled_at from public.messages where id = 902) from public.adventure_messages where id = 902),
  'A delivered message is dated when it was delivered'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.adventure_messages), 0, 'Another Adventurer sees none of them');

reset role;
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'),
  'Changes to messages reach the app as they happen'
);

select * from finish();
rollback;
