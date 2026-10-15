create or replace function private.grace_period() returns interval language sql immutable as $$ select interval '1 minute' $$;

-- alert_at is stored, so it keeps the old Grace Period until the expression is recomputed.
alter table public.adventures alter column alert_at set expression as (private.alert_time(deadline));
