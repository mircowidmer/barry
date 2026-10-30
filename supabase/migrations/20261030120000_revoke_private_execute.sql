-- 20261015082020_core_tables.sql revoked EXECUTE from public with `alter default privileges in schema private`.
-- Per-schema default privileges only add to the global ones and cannot take a global grant away, so every
-- private function created after that file stayed executable by public. Nobody could call one, because only
-- service_role has USAGE on private, but a later grant of USAGE would have opened all of them at once.
-- A function created in private from now on needs its own `revoke execute ... from public`; access.test.sql
-- fails if one is missing.

revoke execute on all functions in schema private from public;
