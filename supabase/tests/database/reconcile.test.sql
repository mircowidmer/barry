begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(31);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com');

insert into public.emergency_contacts (id, adventurer_id, name, email, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com', '+41791111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sara', null, '+41792222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Mia', 'mia@example.com', null),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Noah', 'noah@example.com', null);

-- The push path stays testable while its channel is off; the sms channel is on already.
update private.channel_config set enabled = true where channel in ('push', 'sms');

insert into public.push_devices (expo_push_token, adventurer_id) values
  ('ExponentPushToken[anna]', '11111111-1111-1111-1111-111111111111'),
  ('ExponentPushToken[ben]', '22222222-2222-2222-2222-222222222222');

insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active',
   'Grosser Mythen', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'active',
   'Pilatus', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02'),
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'planned',
   'Rigi', null, null, null, null);

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001');

create function pg_temp.messages(p_adventure uuid, p_kind public.message_kind) returns text[]
language sql as $$
  select coalesce(array_agg(concat_ws(' ', channel, to_address, status, failure_reason, round, for_deadline)
                            order by channel, to_address, round, for_deadline), '{}')
  from public.messages where adventure_id = p_adventure and kind = p_kind
$$;

create function pg_temp.anna() returns public.adventures language sql as $$
  select * from public.adventures where id = 'a0000000-0000-0000-0000-000000000001'
$$;

-- Anna's Adventure: Deadline 18:00, set at 08:00.

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 16:00+02');

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'heads_up'),
  array[
    'email luca@example.com pending',
    'sms +41791111111 pending',
    'sms +41792222222 pending'
  ],
  'Start: Luca gets a Heads-up by email and text message, and phone-only Sara by text message'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 16:00+02');

select is(
  cardinality(pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'heads_up')),
  3,
  'Running reconcile twice queues no second Heads-up'
);

insert into public.adventure_contacts (adventure_id, contact_id)
  values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003');
select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 17:00+02');

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'heads_up'),
  array[
    'email luca@example.com pending',
    'email mia@example.com pending',
    'sms +41791111111 pending',
    'sms +41792222222 pending'
  ],
  'A contact added during the Adventure gets a Heads-up'
);

update public.messages set status = 'cancelled'
  where adventure_id = 'a0000000-0000-0000-0000-000000000001' and to_address = 'mia@example.com';
select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 17:05+02');

select is(
  (select status from public.messages where adventure_id = 'a0000000-0000-0000-0000-000000000001' and to_address = 'mia@example.com'),
  'pending'::public.message_status,
  'A contact removed and added again gets the cancelled Heads-up back'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 17:40+02');

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'reminder'),
  array['push ExponentPushToken[anna] pending 2026-10-17 16:00:00+00'],
  'In the Reminder window Anna gets one Reminder for her Deadline'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 17:50+02');

select is(
  cardinality(pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'reminder')),
  1,
  'A later tick in the Reminder window queues no second Reminder'
);

update public.adventures set deadline = '2026-10-17 20:00+02', deadline_set_at = '2026-10-17 17:50+02'
  where id = 'a0000000-0000-0000-0000-000000000001';
select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 19:35+02');

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'reminder'),
  array[
    'push ExponentPushToken[anna] pending 2026-10-17 16:00:00+00',
    'push ExponentPushToken[anna] pending 2026-10-17 18:00:00+00'
  ],
  'Moving the Deadline later re-arms the Reminder for the new Deadline'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 20:00:30+02');

select is((pg_temp.anna()).stage, 'overdue'::public.adventure_stage, 'At the new Deadline the Adventure becomes Overdue');

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'overdue_notice'),
  array['push ExponentPushToken[anna] pending 2026-10-17 18:00:00+00'],
  'Overdue: Anna gets one Overdue Notice for the current Deadline'
);

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'alert'),
  '{}'::text[],
  'During the Grace Period no Alert is queued'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 20:05+02');

select is((pg_temp.anna()).stage, 'alerted'::public.adventure_stage, 'When the Grace Period ends the Adventure becomes Alerted');
select is((pg_temp.anna()).alerts_sent, 1::smallint, 'One Alert round is recorded');
select is((pg_temp.anna()).last_alert_at, '2026-10-17 20:05+02'::timestamptz, 'The Alert time is when reconcile ran');

select is(
  pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'alert'),
  array[
    'email luca@example.com pending 1 2026-10-17 18:00:00+00',
    'email mia@example.com pending 1 2026-10-17 18:00:00+00',
    'sms +41791111111 pending 1 2026-10-17 18:00:00+00',
    'sms +41792222222 pending 1 2026-10-17 18:00:00+00'
  ],
  'Alert 1 goes to every channel of every contact'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 21:00+02');

select is((pg_temp.anna()).alerts_sent, 1::smallint, 'Within the hour no second Alert round is owed');

select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 21:31+02');
select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 22:31+02');
select private.reconcile('a0000000-0000-0000-0000-000000000001', '2026-10-17 23:31+02');

select is((pg_temp.anna()).alerts_sent, 3::smallint, 'After three hours exactly three Alert rounds went out');

select is(
  cardinality(pg_temp.messages('a0000000-0000-0000-0000-000000000001', 'alert')),
  12,
  'Each round reached the same four contact rows'
);

-- Anna moves the Deadline after the third Alert, and misses the new one too.

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.move_deadline('a0000000-0000-0000-0000-000000000001', date_trunc('minute', now()) + interval '1 hour');
reset role;

select is(
  (select concat_ws(' ', stage, alerts_sent, earlier_alerts, last_alert_at) from public.adventures
    where id = 'a0000000-0000-0000-0000-000000000001'),
  'active 0 3',
  'It is Active again, with no Alert yet for the new Deadline and the three earlier ones kept'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', (pg_temp.anna()).deadline + interval '5 minutes');

select is((pg_temp.anna()).stage, 'alerted'::public.adventure_stage, 'When the new Grace Period ends the Adventure is Alerted again');

select is(
  (select count(*)::int from public.messages
    where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'alert' and round = 1
      and for_deadline = (pg_temp.anna()).deadline),
  4,
  'Alert 1 for the new Deadline goes to every contact row again'
);

select private.reconcile('a0000000-0000-0000-0000-000000000001', (pg_temp.anna()).deadline + interval '65 minutes');
select private.reconcile('a0000000-0000-0000-0000-000000000001', (pg_temp.anna()).deadline + interval '125 minutes');
select private.reconcile('a0000000-0000-0000-0000-000000000001', (pg_temp.anna()).deadline + interval '185 minutes');
select private.reconcile('a0000000-0000-0000-0000-000000000001', (pg_temp.anna()).deadline + interval '10 hours');

select is(
  (select array_agg(round order by round) from (
     select distinct round from public.messages
      where adventure_id = 'a0000000-0000-0000-0000-000000000001' and kind = 'alert'
        and for_deadline = (pg_temp.anna()).deadline) r),
  array[1, 2, 3]::smallint[],
  'The new Deadline gets three Alerts of its own, an hour apart, and no more'
);

select is(
  (select concat_ws(' ', alerts_sent, earlier_alerts) from public.adventures
    where id = 'a0000000-0000-0000-0000-000000000001'),
  '3 3',
  'Six Alerts in all, three for each Deadline'
);

-- Ben's Adventure: the clock was down from before the Reminder until long after the Grace Period.

select private.reconcile('b0000000-0000-0000-0000-000000000001', '2026-10-17 23:00+02');

select is(
  (select stage from public.adventures where id = 'b0000000-0000-0000-0000-000000000001'),
  'alerted'::public.adventure_stage,
  'Catch-up: one reconcile moves an Active Adventure straight to Alerted'
);

select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000001', 'alert'),
  array['email noah@example.com pending 1 2026-10-17 16:00:00+00'],
  'Catch-up: only Alert 1 goes out, never a burst'
);

select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000001', 'overdue_notice'),
  '{}'::text[],
  'Catch-up: no Overdue Notice announcing an Alert time in the past'
);

select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000001', 'reminder'),
  '{}'::text[],
  'Catch-up: no Reminder after the Deadline'
);

select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000001', 'heads_up'),
  array['email noah@example.com pending'],
  'Catch-up: the Heads-up still goes out'
);

-- Ben's Planned Adventure.

select private.reconcile('b0000000-0000-0000-0000-000000000002', '2026-10-17 23:00+02');

select is(
  (select count(*)::int from public.messages where adventure_id = 'b0000000-0000-0000-0000-000000000002'),
  0,
  'A Planned Adventure queues nothing'
);

-- Push turned off.

update private.channel_config set enabled = false where channel = 'push';
update public.adventures set stage = 'active', alerts_sent = 0, last_alert_at = null,
  deadline = '2026-10-18 18:00+02', deadline_set_at = '2026-10-18 08:00+02'
  where id = 'b0000000-0000-0000-0000-000000000001';
select private.reconcile('b0000000-0000-0000-0000-000000000001', '2026-10-18 17:40+02');

select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000001', 'reminder'),
  '{}'::text[],
  'With push disabled no Reminder row is queued'
);

-- Text messages turned off.

update private.channel_config set enabled = false where channel = 'sms';
insert into public.emergency_contacts (id, adventurer_id, name, email, phone) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Lea', 'lea@example.com', '+41793333333'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Tim', null, '+41794444444');
insert into public.adventure_contacts (adventure_id, contact_id) values
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003');
select private.reconcile('b0000000-0000-0000-0000-000000000001', '2026-10-18 17:45+02');

select is(
  pg_temp.messages('b0000000-0000-0000-0000-000000000001', 'heads_up'),
  array[
    'email lea@example.com pending',
    'email noah@example.com pending',
    'sms +41794444444 failed channel_not_enabled'
  ],
  'With text messages disabled Lea gets email only, and phone-only Tim gets one failed row'
);

select lives_ok(
  $$select private.reconcile('00000000-0000-0000-0000-000000000000', now())$$,
  'reconcile on an unknown Adventure does nothing'
);

select * from finish();
rollback;
