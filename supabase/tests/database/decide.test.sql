begin;
create extension if not exists pgtap with schema extensions;

create temporary table cases (
  description text,
  stage public.adventure_stage,
  deadline timestamptz,
  deadline_set_at timestamptz,
  alerts_sent smallint,
  last_alert_at timestamptz,
  now timestamptz,
  expected private.clock_decision
) on commit drop;

insert into cases values
  ('Planned owes nothing',
    'planned', null, null, 0, null, '2026-10-17 17:45+02', row(null, false, false, null)),
  ('Ended owes nothing',
    'ended', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 19:30+02', row(null, false, false, null)),

  ('Active long before the Deadline owes nothing',
    'active', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 16:00+02', row(null, false, false, null)),
  ('Active one second before the Reminder time owes nothing',
    'active', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 17:29:59+02', row(null, false, false, null)),
  ('Active at the Reminder time owes the Reminder',
    'active', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 17:30+02', row(null, true, false, null)),
  ('Active later in the Reminder window still owes the Reminder',
    'active', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 17:45+02', row(null, true, false, null)),
  ('Deadline set exactly 30 minutes ahead owes the Reminder',
    'active', '2026-10-17 18:00+02', '2026-10-17 17:30+02', 0, null, '2026-10-17 17:31+02', row(null, true, false, null)),
  ('Deadline set 29 minutes ahead owes no Reminder',
    'active', '2026-10-17 18:00+02', '2026-10-17 17:31+02', 0, null, '2026-10-17 17:50+02', row(null, false, false, null)),
  ('Deadline set 15 minutes ahead owes no Reminder',
    'active', '2026-10-17 18:00+02', '2026-10-17 17:45+02', 0, null, '2026-10-17 17:45+02', row(null, false, false, null)),
  ('Active at the Deadline becomes Overdue',
    'active', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 18:00+02', row('overdue', false, false, null)),
  ('Active long after the Deadline becomes Overdue, one step at a time',
    'active', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 21:00+02', row('overdue', false, false, null)),

  ('Overdue at the Deadline owes the Overdue Notice',
    'overdue', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 18:00+02', row(null, false, true, null)),
  ('Overdue one second before the Grace Period ends owes the Overdue Notice',
    'overdue', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 18:00:59+02', row(null, false, true, null)),
  ('Overdue when the Grace Period ends becomes Alerted with Alert 1',
    'overdue', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 18:01+02', row('alerted', false, false, 1)),
  ('Overdue long after the Grace Period skips the Overdue Notice and sends Alert 1',
    'overdue', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 0, null, '2026-10-17 21:00+02', row('alerted', false, false, 1)),

  ('Alerted within the hour owes nothing',
    'alerted', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 19:29:59+02', row(null, false, false, null)),
  ('Alerted an hour after Alert 1 owes Alert 2',
    'alerted', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 19:30+02', row(null, false, false, 2)),
  ('Alerted an hour after Alert 2 owes Alert 3',
    'alerted', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 2, '2026-10-17 19:30+02', '2026-10-17 20:30+02', row(null, false, false, 3)),
  ('Alerted after Alert 3 owes nothing',
    'alerted', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 3, '2026-10-17 20:30+02', '2026-10-18 06:00+02', row(null, false, false, null)),
  ('Alerted hours after Alert 1 owes only Alert 2, never a burst',
    'alerted', '2026-10-17 18:00+02', '2026-10-17 08:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 23:00+02', row(null, false, false, 2));

select plan((select count(*)::int from cases) + 1);

select is(
  private.decide(stage, deadline, deadline_set_at, alerts_sent, last_alert_at, now),
  expected,
  description
) from cases;

select is(
  (select provolatile from pg_proc where oid = 'private.decide'::regproc),
  'i'::"char",
  'decide() is immutable'
);

select * from finish();
rollback;
