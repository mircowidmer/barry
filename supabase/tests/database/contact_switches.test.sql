begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000000');

insert into public.emergency_contacts (id, adventurer_id, name, email, email_enabled, phone, phone_enabled) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com', true, '+41791111111', false),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sara', 'sara@example.com', false, '+41792222222', true);

insert into public.adventures (id, adventurer_id, stage, destination, deadline) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'planned', 'Crap Sogn Gion', now() + interval '2 hours');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');

create function pg_temp.messages(p_kind public.message_kind) returns text[] language sql as $$
  select coalesce(array_agg(concat_ws(' ', channel, to_address, status, failure_reason) order by channel, to_address), '{}')
  from public.messages where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = p_kind
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Saving a contact

select lives_ok(
  $$insert into public.emergency_contacts (name, email, phone, phone_enabled) values ('Mia', 'mia@example.com', '+41793333333', false)$$,
  'A contact saves with one address switched off'
);
select throws_ok(
  $$insert into public.emergency_contacts (name, email, email_enabled) values ('Noah', 'noah@example.com', false)$$,
  '23514', null,
  'A contact whose only address is switched off is refused'
);
insert into public.emergency_contacts (name, phone) values ('Olga', '+41794444444');
select is(
  (select email_enabled and phone_enabled from public.emergency_contacts where name = 'Olga'),
  true,
  'Both switches are on by default'
);
select throws_ok(
  $$update public.emergency_contacts set phone_enabled = false where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '23514', null,
  'Switching off the last address that is on is refused'
);
select lives_ok(
  $$update public.emergency_contacts set phone_enabled = true where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'The Adventurer can switch an address back on'
);
update public.emergency_contacts set phone_enabled = false where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select phone from public.emergency_contacts where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '+41791111111',
  'A switched-off phone number is kept'
);

-- Reaching a contact

select public.start_adventure('a0000000-0000-0000-0000-000000000001', 'Europe/Zurich');

reset role;

select is(
  pg_temp.messages('heads_up'),
  array['email luca@example.com pending', 'sms +41792222222 pending'],
  'The Heads-up goes only to the addresses that are switched on'
);

update private.channel_config set enabled = false where channel = 'sms';
select private.enqueue_to_contacts('a0000000-0000-0000-0000-000000000001', 'alert', 1::smallint);

select is(
  pg_temp.messages('alert'),
  array['email luca@example.com pending', 'sms +41792222222 failed channel_not_enabled'],
  'With text messages off, Sara is a Delivery Failure: Barry never falls back to her switched-off email address'
);

select * from finish();
rollback;
