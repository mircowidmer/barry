begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(3);

insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'ben@example.com');
insert into public.adventurer_profiles (id, name) values ('22222222-2222-2222-2222-222222222222', 'Ben');
insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Luca', 'luca@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Sara', 'sara@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

create temporary table adventure on commit drop as
select adventure_id as id from public.save_adventure(null, 'Rigi', now() + interval '8 hours',
  array['bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002']::uuid[]);
select public.start_adventure((select id from adventure), 'Europe/Zurich');

-- Sara leaves the Adventure in progress after her Heads-up was queued, so no Adventure links her any more.
select public.save_adventure((select id from adventure), 'Rigi', null, array['bbbbbbbb-0000-0000-0000-000000000001']::uuid[]);

select throws_ok(
  $$update public.emergency_contacts set email = 'someone-new@example.com' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'P0001', 'barry:contact_in_use',
  'a contact removed from an Adventure in progress keeps the address it got messages on, so adding it back reaches nobody new');

select lives_ok(
  $$update public.emergency_contacts set email_enabled = true, email = 'sara@example.com' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'it can still be saved with the same address');

select public.check_in((select id from adventure), now());
select lives_ok(
  $$update public.emergency_contacts set email = 'sara-new@example.com' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'once the Adventure ended, the address can change');

select * from finish();
rollback;
