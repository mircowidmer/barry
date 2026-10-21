-- The phone number is optional. Start keeps needing a Profile, which now holds the name alone, and
-- an Alert without a number leaves its phone line out.
alter table public.adventurer_profiles alter column phone drop not null;
