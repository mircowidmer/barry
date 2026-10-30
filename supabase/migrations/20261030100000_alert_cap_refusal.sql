-- Postgres cannot use a new enum value in the transaction that adds it, so move_deadline, which returns it,
-- comes in the next migration.
alter type public.refusal add value 'too_many_alerts';
