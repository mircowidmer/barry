begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.emergency_contacts (id, adventurer_id, name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com', '+41791111111');
insert into public.adventures (id, adventurer_id, stage, destination, deadline, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Grosser Mythen',
   now() + interval '2 hours', 'Europe/Zurich', now());
delete from public.messages;

create function pg_temp.failed(p_kind public.message_kind, p_channel public.channel, p_address text, p_reason text) returns void
language sql as $$
  insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id, status, failure_reason)
  values ('a0000000-0000-0000-0000-000000000001', p_kind, case when p_kind = 'alert' then 1 end, p_channel, p_address,
          'aaaaaaaa-0000-0000-0000-000000000001', 'failed', p_reason)
$$;

create function pg_temp.delivery_ok() returns boolean language sql as $$ select delivery_ok from public.health() $$;

select is(pg_temp.delivery_ok(), true, 'Without messages delivery is healthy');

select pg_temp.failed('heads_up', 'sms', '+41790000001', 'HTTP 400: Twilio 21211: invalid number');
select is(pg_temp.delivery_ok(), true, 'One text message to a bad number is a Delivery Failure, not an outage');

select pg_temp.failed('alert', 'email', 'luca@example.com', 'HTTP 403: Resend validation_error');
select is(pg_temp.delivery_ok(), false, 'A failed Alert is not healthy');
delete from public.messages;

select pg_temp.failed('heads_up', 'sms', '+41790000001', 'HTTP 401: Twilio 20003: Authenticate');
select pg_temp.failed('heads_up', 'sms', '+41790000002', 'HTTP 401: Twilio 20003: Authenticate');
select pg_temp.failed('heads_up', 'sms', '+41790000003', 'HTTP 401: Twilio 20003: Authenticate');
select is(pg_temp.delivery_ok(), false, 'Three failed text messages and none sent in 15 minutes is not healthy');

update public.messages set settled_at = now() - interval '20 minutes';
select is(pg_temp.delivery_ok(), true, 'Failures older than 15 minutes no longer count');
delete from public.messages;

select pg_temp.failed('heads_up', 'sms', '+41790000001', 'channel_not_enabled');
select pg_temp.failed('heads_up', 'sms', '+41790000002', 'channel_not_enabled');
select pg_temp.failed('alert', 'sms', '+41790000003', 'channel_not_enabled');
select is(pg_temp.delivery_ok(), true, 'Messages to a switched-off channel are no outage');
delete from public.messages;

insert into public.messages (adventure_id, kind, channel, to_address, contact_id, status, attempts)
values ('a0000000-0000-0000-0000-000000000001', 'heads_up', 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'sending', 1);
select public.settle_message((select id from public.messages), 1::smallint, 'sent', 'SM1');
select pg_temp.failed('heads_up', 'sms', '+41790000001', 'HTTP 400: Twilio 21211: invalid number');
select pg_temp.failed('heads_up', 'sms', '+41790000002', 'HTTP 400: Twilio 21211: invalid number');
select pg_temp.failed('heads_up', 'sms', '+41790000003', 'HTTP 400: Twilio 21211: invalid number');
select is(pg_temp.delivery_ok(), true, 'Failures beside a text message that went out are bad numbers, not an outage');

select * from finish();
rollback;
