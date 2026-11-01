begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
delete from public.messages;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'anna@example.com');
insert into public.adventurer_profiles (id, name, phone) values ('11111111-1111-1111-1111-111111111111', 'Anna', '+41790000000');
insert into public.emergency_contacts (id, adventurer_id, name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com', '+41791111111');
insert into public.adventures (id, adventurer_id, stage, destination, deadline, time_zone, started_at, alerts_sent, last_alert_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'alerted', 'Pilatus',
   now() - interval '1 hour', 'Europe/Zurich', now() - interval '3 hours', 1, now());

insert into public.messages (id, adventure_id, kind, round, channel, to_address, contact_id, status, attempts, provider_ref) overriding system value values
  (901, 'a0000000-0000-0000-0000-000000000001', 'heads_up', null, 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1, 'SM-heads-up'),
  (902, 'a0000000-0000-0000-0000-000000000001', 'alert', 1, 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1, 'SM-alert'),
  (903, 'a0000000-0000-0000-0000-000000000001', 'heads_up', null, 'email', 'luca@example.com', 'aaaaaaaa-0000-0000-0000-000000000001', 'sent', 1, 're_heads_up');

create function pg_temp.row(p_id bigint) returns text language sql as $$
  select concat_ws(' ', status, failure_reason, case when delivered_at is not null then 'delivered' end) from public.messages where id = p_id
$$;

select public.report_delivery(901, 'SM-heads-up', 'delivered');
select is(pg_temp.row(901), 'sent delivered', 'A delivered report records the delivery time and keeps the message sent');

select public.report_delivery(901, 'SM-someone-else', 'undelivered', 'Twilio 30003: Unreachable destination handset');
select is(pg_temp.row(901), 'sent delivered', 'A report with another Twilio sid changes nothing');

select public.report_delivery(903, 're_heads_up', 'undelivered', 'Twilio 30003: Unreachable destination handset');
select is(pg_temp.row(903), 'sent', 'A report for an email changes nothing');

select is((select delivery_ok from public.health()), true, 'Before the undelivered Alert, delivery is healthy');

select public.report_delivery(902, 'SM-alert', 'undelivered', 'Twilio 30003: Unreachable destination handset');
select is(pg_temp.row(902), 'failed Twilio 30003: Unreachable destination handset', 'An undelivered report fails the message with the Twilio error');
select is(
  (select array_agg(kind::text || ' ' || failure_reason) from public.delivery_failures where adventure_id = 'a0000000-0000-0000-0000-000000000001'),
  array['alert Twilio 30003: Unreachable destination handset'],
  'The undelivered Alert is a Delivery Failure for the Adventurer'
);
select is((select delivery_ok from public.health()), false, 'An undelivered Alert makes the monitor raise the alarm');

-- 904 failed to send; 905 is still sending when its report arrives.
insert into public.messages (id, adventure_id, kind, plan_revision, channel, to_address, contact_id, status, attempts, failure_reason) overriding system value values
  (904, 'a0000000-0000-0000-0000-000000000001', 'plan_update', 1, 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'failed', 1, 'channel_not_enabled'),
  (905, 'a0000000-0000-0000-0000-000000000001', 'plan_update', 2, 'sms', '+41791111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'sending', 1, null);
select public.report_delivery(905, 'SM-overtaking', 'undelivered', 'Twilio 30005: Unknown destination handset');
select is(
  (select array_agg(id order by id) from public.adventure_messages where undelivered),
  array[902, 905]::bigint[],
  'Only the text messages Twilio reported not delivered are undelivered, also a report that overtook settle_message'
);

set local role authenticated;
select throws_ok($$select public.report_delivery(901, 'SM-heads-up', 'undelivered')$$, '42501', null, 'The app cannot report deliveries');

select * from finish();
rollback;
