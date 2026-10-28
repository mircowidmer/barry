-- Postgres cannot use a new enum value in the transaction that adds it, so the commands that
-- return these refusals come in the next migration.
alter type public.refusal add value 'too_many_contacts';
alter type public.refusal add value 'too_many_starts';
