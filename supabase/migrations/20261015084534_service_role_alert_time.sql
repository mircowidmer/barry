-- Writing an Adventure recomputes alert_at, so a trusted server writing outside the commands,
-- such as the dashboard or an admin script, needs these two helpers.
grant usage on schema private to service_role;
grant execute on function private.alert_time, private.grace_period to service_role;
