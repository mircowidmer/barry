begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(9);
delete from public.messages;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name) values ('11111111-1111-1111-1111-111111111111', 'Anna');
insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com');
insert into public.adventures (id, adventurer_id, destination, deadline) values
  ('a0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Rigi', now() + interval '8 hours');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select adventure_id, refusal::text from public.save_and_start_adventure(
       null, null, now() + interval '8 hours', '{aaaaaaaa-0000-0000-0000-000000000001}', 'Europe/Zurich') $$,
  $$ values (null::uuid, 'destination_missing') $$,
  'A refused Start on a new Plan names the refusal and no Adventure'
);
select is((select count(*)::int from public.adventures), 1, 'A refused Start on a new Plan leaves no Planned Adventure');

select results_eq(
  $$ select adventure_id, refusal::text from public.save_and_start_adventure(
       'a0000000-0000-0000-0000-000000000011', 'Pilatus', now() + interval '9 hours', '{}', 'Europe/Zurich') $$,
  $$ values ('a0000000-0000-0000-0000-000000000011'::uuid, 'no_contacts') $$,
  'A refused Start on a Planned Adventure names the refusal'
);
select is(
  (select destination from public.adventures where id = 'a0000000-0000-0000-0000-000000000011'),
  'Rigi',
  'A refused Start keeps the Planned Adventure as it was saved'
);

select results_eq(
  $$ select refusal::text from public.save_and_start_adventure(
       null, 'Rigi', now() + interval '8 hours', '{aaaaaaaa-0000-0000-0000-00000000dead}', 'Europe/Zurich') $$,
  $$ values ('unknown_contact') $$,
  'A refused save is the refusal of the Start'
);

select is(
  (select refusal::text from public.save_and_start_adventure(
     null, 'Grosser Mythen', now() + interval '8 hours', '{aaaaaaaa-0000-0000-0000-000000000001}', 'Europe/Zurich',
     null, 47.03, 8.68, 12, null)),
  null,
  'A new Plan saves and starts in one call'
);
select is(
  (select stage::text || ' ' || time_zone from public.adventures where destination = 'Grosser Mythen'),
  'active Europe/Zurich',
  'The started Adventure is Active in the phone''s time zone'
);
select is(
  (select array_agg(m.to_address) from public.messages m
     join public.adventures a on a.id = m.adventure_id
    where a.destination = 'Grosser Mythen' and m.kind = 'heads_up'),
  '{luca@example.com}',
  'The Start enqueues the Heads-up to the chosen contact'
);

reset role;
select ok(
  not has_function_privilege('anon',
    'public.save_and_start_adventure(uuid, text, timestamptz, uuid[], text, jsonb, double precision, double precision, real, timestamptz)',
    'execute'),
  'Only a signed-in Adventurer can save and start'
);

select * from finish();
rollback;
