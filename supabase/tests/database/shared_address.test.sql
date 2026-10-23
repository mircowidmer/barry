begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000000');

insert into public.emergency_contacts (id, adventurer_id, name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com', '+41791111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Luca at work', 'luca@example.com', '+41791111111');

insert into public.adventures (id, adventurer_id, stage, destination, deadline) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'planned', 'Crap Sogn Gion', now() + interval '2 hours');

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');

create function pg_temp.messages(p_kind public.message_kind) returns text[] language sql as $$
  select coalesce(array_agg(concat_ws(' ', channel, to_address, status) order by channel, to_address), '{}')
  from public.messages where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = p_kind
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  public.start_adventure('a0000000-0000-0000-0000-000000000001', 'Europe/Zurich'),
  null,
  'Two contacts with the same email address and phone number can start an Adventure'
);

reset role;

select is(
  pg_temp.messages('heads_up'),
  array['email luca@example.com pending', 'sms +41791111111 pending'],
  'A shared address gets one Heads-up per channel'
);


select * from finish();
rollback;
