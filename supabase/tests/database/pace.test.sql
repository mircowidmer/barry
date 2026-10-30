begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(10);

select is(private.update_pace(), interval '15 minutes', 'an address gets at most one Plan Update and one Deadline Update in 15 minutes');

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name) values ('11111111-1111-1111-1111-111111111111', 'Anna');
insert into public.emergency_contacts (id, adventurer_id, name, email)
select ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       '11111111-1111-1111-1111-111111111111', 'Contact ' || n, 'contact' || n || '@example.com'
from generate_series(1, 10) n;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temporary table adventure on commit drop as
select adventure_id as id from public.save_adventure(null, 'Rigi', now() + interval '8 hours',
  array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);
select public.start_adventure((select id from adventure), 'Europe/Zurich');

select throws_ok(
  $$update public.emergency_contacts set email = 'someone-else@example.com' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'P0001', 'barry:contact_in_use', 'the address of a contact an Adventure in progress uses cannot change');
select lives_ok(
  $$update public.emergency_contacts set email = 'new2@example.com' where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  'the address of a contact no Adventure in progress uses can change');
select lives_ok(
  $$update public.emergency_contacts set email_enabled = true, email = 'contact1@example.com' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a contact in use can still be saved with the same address');

reset role;
update public.messages set status = 'sent', sent_at = now() where kind = 'heads_up';
set local role authenticated;

select public.save_adventure((select id from adventure), 'Pilatus', null, array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);
select ok((select next_attempt_at <= now() from public.messages where kind = 'plan_update' and status = 'pending'),
  'the first Plan Update goes out at once');

reset role;
update public.messages set status = 'sent', sent_at = now() where kind = 'plan_update' and status = 'pending';
set local role authenticated;

select public.save_adventure((select id from adventure), 'Titlis', null, array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);
select is((select next_attempt_at from public.messages where kind = 'plan_update' and status = 'pending'),
  now() + interval '15 minutes', 'the next Plan Update to the same address waits 15 minutes after the last one');

-- The waiting Plan Update goes out 15 minutes later; the next one counts from that send, not from its creation.
reset role;
update public.messages set status = 'sent', sent_at = now() + interval '15 minutes' where kind = 'plan_update' and status = 'pending';
set local role authenticated;

select public.save_adventure((select id from adventure), 'Engelberg', null, array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);
select is((select next_attempt_at from public.messages where kind = 'plan_update' and status = 'pending'),
  now() + interval '30 minutes', 'a Plan Update that waited paces the next one from when it went out');

select public.move_deadline((select id from adventure), now() + interval '9 hours');
select is((select next_attempt_at from public.messages where kind = 'deadline_update' and status = 'pending'),
  now() + interval '3 minutes', 'a first Deadline Update waits only its usual 3 minutes');

-- Swapping contacts in and out: the five already reached and five new ones are ten, an eleventh is one too many.
reset role;
insert into public.messages (adventure_id, kind, channel, to_address, contact_id, status)
select (select id from adventure), 'heads_up', 'email', 'contact' || n || '@example.com',
       ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'cancelled'
from generate_series(2, 5) n;
update public.emergency_contacts set removed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000002';
insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Eleventh', 'eleventh@example.com');
set local role authenticated;

select is(
  (select refusal from public.save_adventure((select id from adventure), 'Titlis', null,
     array['aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000008',
           'aaaaaaaa-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000010']::uuid[])),
  null::public.refusal, 'an Adventure can reach ten different contacts over its time');
select is(
  (select refusal from public.save_adventure((select id from adventure), 'Titlis', null,
     array['aaaaaaaa-0000-0000-0000-000000000011']::uuid[])),
  'too_many_contacts'::public.refusal, 'an eleventh different contact on the same Adventure is refused');

select * from finish();
rollback;
