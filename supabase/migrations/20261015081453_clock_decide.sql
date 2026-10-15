create schema if not exists private;

create type public.adventure_stage as enum ('planned', 'active', 'overdue', 'alerted', 'ended');

create function private.grace_period()   returns interval language sql immutable as $$ select interval '30 minutes' $$;
create function private.reminder_lead()  returns interval language sql immutable as $$ select interval '30 minutes' $$;
create function private.alert_interval() returns interval language sql immutable as $$ select interval '1 hour' $$;
create function private.max_alerts()     returns smallint language sql immutable as $$ select 3::smallint $$;

create type private.clock_decision as (
  next_stage         public.adventure_stage,
  owe_reminder       boolean,
  owe_overdue_notice boolean,
  alert_round        smallint
);

create function private.decide(
  stage public.adventure_stage, deadline timestamptz, deadline_set_at timestamptz,
  alerts_sent smallint, last_alert_at timestamptz, now timestamptz
) returns private.clock_decision
language sql immutable as $$
  select case
    when stage = 'active' and now >= deadline then
      row('overdue', false, false, null)::private.clock_decision
    when stage = 'active' and now >= deadline - private.reminder_lead()
                          and deadline_set_at <= deadline - private.reminder_lead() then
      row(null, true, false, null)::private.clock_decision
    when stage = 'overdue' and now >= deadline + private.grace_period() then
      row('alerted', false, false, 1)::private.clock_decision
    when stage = 'overdue' and now >= deadline then
      row(null, false, true, null)::private.clock_decision
    when stage = 'alerted' and alerts_sent < private.max_alerts()
                           and now >= last_alert_at + private.alert_interval() then
      row(null, false, false, alerts_sent + 1)::private.clock_decision
    else
      row(null, false, false, null)::private.clock_decision
  end
$$;
