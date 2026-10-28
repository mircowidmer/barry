begin;
create extension if not exists pgtap with schema extensions;

create temporary table cases (
  description text,
  stage public.adventure_stage,
  deadline timestamptz,
  alerts_sent smallint,
  last_alert_at timestamptz,
  now timestamptz,
  expected private.clock_decision
) on commit drop;

insert into cases values
  ('Planned owes nothing',
    'planned', null, 0, null, '2026-10-17 17:45+02', row(null, null)),
  ('Ended owes nothing',
    'ended', '2026-10-17 18:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 19:30+02', row(null, null)),

  ('Active long before the Deadline owes nothing',
    'active', '2026-10-17 18:00+02', 0, null, '2026-10-17 16:00+02', row(null, null)),
  ('Active one second before the Deadline owes nothing',
    'active', '2026-10-17 18:00+02', 0, null, '2026-10-17 17:59:59+02', row(null, null)),
  ('Active at the Deadline becomes Overdue',
    'active', '2026-10-17 18:00+02', 0, null, '2026-10-17 18:00+02', row('overdue', null)),
  ('Active long after the Deadline becomes Overdue, one step at a time',
    'active', '2026-10-17 18:00+02', 0, null, '2026-10-17 21:00+02', row('overdue', null)),

  ('Overdue at the Deadline owes nothing while the Grace Period runs',
    'overdue', '2026-10-17 18:00+02', 0, null, '2026-10-17 18:00+02', row(null, null)),
  ('Overdue one second before the Grace Period ends owes nothing',
    'overdue', '2026-10-17 18:00+02', 0, null, '2026-10-17 18:04:59+02', row(null, null)),
  ('Overdue when the Grace Period ends becomes Alerted with Alert 1',
    'overdue', '2026-10-17 18:00+02', 0, null, '2026-10-17 18:05+02', row('alerted', 1)),
  ('Overdue long after the Grace Period becomes Alerted with Alert 1',
    'overdue', '2026-10-17 18:00+02', 0, null, '2026-10-17 21:00+02', row('alerted', 1)),

  ('Alerted within the hour owes nothing',
    'alerted', '2026-10-17 18:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 19:29:59+02', row(null, null)),
  ('Alerted an hour after Alert 1 owes Alert 2',
    'alerted', '2026-10-17 18:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 19:30+02', row(null, 2)),
  ('Alerted an hour after Alert 2 owes Alert 3',
    'alerted', '2026-10-17 18:00+02', 2, '2026-10-17 19:30+02', '2026-10-17 20:30+02', row(null, 3)),
  ('Alerted after Alert 3 owes nothing',
    'alerted', '2026-10-17 18:00+02', 3, '2026-10-17 20:30+02', '2026-10-18 06:00+02', row(null, null)),
  ('Alerted hours after Alert 1 owes only Alert 2, never a burst',
    'alerted', '2026-10-17 18:00+02', 1, '2026-10-17 18:30+02', '2026-10-17 23:00+02', row(null, 2));

select plan((select count(*)::int from cases) + 1);

select is(
  private.decide(stage, deadline, alerts_sent, last_alert_at, now),
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
