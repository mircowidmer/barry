begin;
create extension if not exists pgtap with schema extensions;
set local timezone = 'UTC';
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'cleo@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'dan@example.com');

insert into public.emergency_contacts (id, adventurer_id, name, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luca', 'luca@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Noah', 'noah@example.com'),
  ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Olga', 'olga@example.com'),
  ('dddddddd-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Paul', 'paul@example.com');

-- Anna: Deadline just passed. Ben: Deadline hours away. Cleo: all three Alerts sent.
-- Dan: Grace Period over, but queuing his messages fails.
insert into public.adventures (id, adventurer_id, stage, destination, deadline, deadline_set_at, time_zone,
                               started_at, alerts_sent, last_alert_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'active', 'Grosser Mythen',
   '2026-10-17 17:59:30+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02', 0, null),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'active', 'Pilatus',
   '2026-10-17 23:00+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02', 0, null),
  ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'alerted', 'Rigi',
   '2026-10-17 12:00+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02', 3, '2026-10-17 14:30+02'),
  ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'overdue', 'Titlis',
   '2026-10-17 17:00+02', '2026-10-17 08:00+02', 'Europe/Zurich', '2026-10-17 08:00+02', 0, null);

insert into public.adventure_contacts (adventure_id, contact_id) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001');

create function pg_temp.refuse_dan() returns trigger language plpgsql as $$
begin
  if new.adventure_id = 'd0000000-0000-0000-0000-000000000001' then
    raise exception 'simulated failure for Dan';
  end if;
  return new;
end $$;
create trigger refuse_dan before insert on public.messages
  for each row execute function pg_temp.refuse_dan();

select lives_ok(
  $$select private.tick('2026-10-17 18:00+02')$$,
  'tick runs even though one Adventure fails'
);

select is(
  (select stage from public.adventures where id = 'a0000000-0000-0000-0000-000000000001'),
  'overdue'::public.adventure_stage,
  'Anna''s Adventure became Overdue'
);

select is(
  (select count(*)::int from public.messages where adventure_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'Ben''s Adventure is not due yet, so tick leaves it alone'
);

select is(
  (select count(*)::int from public.messages where adventure_id = 'c0000000-0000-0000-0000-000000000001'),
  0,
  'Cleo''s Adventure has sent all three Alerts, so tick leaves it alone'
);

select is(
  (select stage from public.adventures where id = 'd0000000-0000-0000-0000-000000000001'),
  'overdue'::public.adventure_stage,
  'Dan''s failed reconcile is rolled back, so his Adventure stays Overdue'
);

select is(
  (select array_agg(adventure_id::text || ' ' || message) from private.tick_error),
  array['d0000000-0000-0000-0000-000000000001 simulated failure for Dan'],
  'The failure is recorded for Dan''s Adventure'
);

select is(
  (select last_tick_at from private.clock_status),
  '2026-10-17 18:00+02'::timestamptz,
  'tick records when it ran'
);

drop trigger refuse_dan on public.messages;
select private.tick('2026-10-17 18:01+02');

select is(
  (select last_tick_at from private.clock_status),
  '2026-10-17 18:01+02'::timestamptz,
  'The next tick updates the same clock row'
);

select is(
  (select stage from public.adventures where id = 'd0000000-0000-0000-0000-000000000001'),
  'alerted'::public.adventure_stage,
  'Once the failure is gone, the next tick sends Dan''s Alert'
);

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'barry-tick'),
  '* * * * * select private.tick()',
  'pg_cron runs tick every minute'
);

select is(
  has_function_privilege('authenticated', 'private.tick(timestamptz)', 'execute'),
  false,
  'The app cannot run tick'
);

select is(
  (select count(*)::int from private.clock_status),
  1,
  'There is one clock row'
);

select * from finish();
rollback;
