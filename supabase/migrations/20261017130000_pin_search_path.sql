-- The Supabase linter flags functions without a fixed search_path. These name everything with its
-- schema already, so an empty search_path changes nothing but rules out a lookup in another schema.

alter function private.alert_interval() set search_path = '';
alter function private.alert_time(timestamptz) set search_path = '';
alter function private.deadline_update_delay() set search_path = '';
alter function private.decide(public.adventure_stage, timestamptz, timestamptz, smallint, timestamptz, timestamptz) set search_path = '';
alter function private.grace_period() set search_path = '';
alter function private.max_alerts() set search_path = '';
alter function private.max_attempts() set search_path = '';
alter function private.reminder_lead() set search_path = '';
alter function private.retry_backoff(smallint) set search_path = '';
alter function private.stamp_settled() set search_path = '';
