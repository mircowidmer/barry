begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(11);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000001');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Noah', 'noah@example.com');

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Pilatus',
   now() + interval '5 hours', now(), 'Europe/Zurich', now());
insert into public.adventures (id, adventurer_id, destination, deadline) values
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Rigi', now() + interval '5 hours');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.messages (adventure_id, kind, channel, to_address, contact_id, status, attempts) values
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1),
  ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'email', 'mia@example.com', 'aaaaaaaa-0000-0000-0000-000000000002', 'sent', 1);

create function pg_temp.updates(p_adventure uuid) returns text[]
language sql as $$
  select coalesce(array_agg(concat_ws(' ', to_address, status) order by to_address, id), '{}')
  from public.messages where adventure_id = p_adventure and kind = 'plan_update'
$$;

create function pg_temp.save(p_adventure uuid, p_destination text, p_contacts uuid[]) returns public.refusal
language sql as $$
  select refusal from public.save_adventure(p_adventure, p_destination, null, p_contacts)
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select pg_temp.save('a0000000-0000-0000-0000-000000000001', 'Pilatus',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[]);
select is(pg_temp.updates('a0000000-0000-0000-0000-000000000001'), '{}'::text[],
  'An unchanged Plan sends no Plan update');

select public.save_adventure('a0000000-0000-0000-0000-000000000001', 'Pilatus', null,
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[],
  '{"latitude": 46.9786, "longitude": 8.2547}'::jsonb);
select is(pg_temp.updates('a0000000-0000-0000-0000-000000000001'), '{}'::text[],
  'A point on the map alone sends no Plan update, because the contacts are not told it');

select pg_temp.save('a0000000-0000-0000-0000-000000000001', 'Pilatus Kulm',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[]);
select is(pg_temp.updates('a0000000-0000-0000-0000-000000000001'),
  array['luca@example.com pending', 'mia@example.com pending'],
  'A changed destination queues a Plan update for each contact');

select pg_temp.save('a0000000-0000-0000-0000-000000000001', 'Tomlishorn',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003']::uuid[]);
select is(pg_temp.updates('a0000000-0000-0000-0000-000000000001'),
  array['luca@example.com cancelled', 'luca@example.com pending', 'mia@example.com cancelled'],
  'A second change replaces the unsent Plan update, and a removed contact gets none');
select is(
  (select array_agg(concat_ws(' ', to_address, status)) from public.messages
    where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'heads_up' and to_address = 'noah@example.com'),
  array['noah@example.com pending'],
  'A contact added in the same save gets a Heads-up instead');

select pg_temp.save('a0000000-0000-0000-0000-000000000001', 'Matthorn',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003']::uuid[]);
select is(
  (select count(*)::int from public.messages
    where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'plan_update' and to_address = 'noah@example.com'),
  0,
  'A contact whose Heads-up is not sent yet gets no Plan update, because the Heads-up carries the latest Plan');

reset role;
update public.messages set status = 'sent' where to_address = 'luca@example.com' and status = 'pending';
set local role authenticated;
select pg_temp.save('a0000000-0000-0000-0000-000000000001', 'Klimsenhorn',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003']::uuid[]);
select is(
  (select array_agg(status order by id) from public.messages
    where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'plan_update' and to_address = 'luca@example.com'),
  array['cancelled', 'cancelled', 'sent', 'pending']::public.message_status[],
  'Each change after a sent Plan update queues a new one');

select pg_temp.save('a0000000-0000-0000-0000-000000000002', 'Rigi Kulm', array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]);
select is(pg_temp.updates('a0000000-0000-0000-0000-000000000002'), '{}'::text[],
  'A Planned Adventure sends no Plan update');

reset role;
select is(
  (select public.message_facts(m.id) - 'deadline'
     from public.messages m
    where m.adventure_id = 'a0000000-0000-0000-0000-000000000001' and m.kind = 'plan_update' and m.status = 'pending'),
  jsonb_build_object(
    'kind', 'plan_update', 'adventurer_name', 'Anna', 'contact_name', 'Luca', 'time_zone', 'Europe/Zurich', 'language', 'en',
    'plan', jsonb_build_object('destination', 'Klimsenhorn'),
    'trail_token', (select trail_token from public.adventure_contacts
                     where adventure_id = 'a0000000-0000-0000-0000-000000000001'
                       and contact_id = 'aaaaaaaa-0000-0000-0000-000000000001')),
  'The Plan update carries the latest Plan and the contact''s Trail Map token');

update public.messages set status = 'failed', failure_reason = 'bounced'
 where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'plan_update' and status = 'pending';
select is(
  (select array_agg(kind) from public.delivery_failures where adventure_id = 'a0000000-0000-0000-0000-000000000001'),
  array['plan_update']::public.message_kind[],
  'A failed Plan update shows as a Delivery Failure');

set local role authenticated;
select pg_temp.save('a0000000-0000-0000-0000-000000000001', 'Esel',
  array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003']::uuid[]);
select public.check_in('a0000000-0000-0000-0000-000000000001', now());
select is(
  (select count(*)::int from public.messages
    where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'plan_update' and status = 'pending'),
  0,
  'A Check-in cancels an unsent Plan update');

select * from finish();
rollback;
