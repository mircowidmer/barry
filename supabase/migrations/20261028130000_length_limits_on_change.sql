-- The length limits of 20261028120100_message_limits.sql were NOT VALID check constraints. Postgres checks those
-- on every update of a row, not only when the column changes, so an Adventure saved before the limits with a
-- longer destination could no longer go Overdue, be Alerted, take a Check-in or move its Deadline: each of those
-- updates the row and failed the check. Triggers check a text only when it is new or changed, so rows saved
-- before the limits stay as they are and every other update goes through.
--
-- The same migration made the contact limit a count in a trigger, which two inserts at once could both pass.
-- The count now waits for any other change to the same Adventurer's contacts.

alter table public.adventures drop constraint destination_length;
alter table public.adventurer_profiles
  drop constraint name_length,
  drop constraint car_make_length,
  drop constraint car_colour_length,
  drop constraint car_plate_length,
  drop constraint medical_notes_length;
alter table public.emergency_contacts
  drop constraint name_length,
  drop constraint email_length;

-- Raises like the check constraints did, so the app and the tests see the same error.
create function private.check_length(p_column text, p_new text, p_old text, p_max int) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_new is distinct from p_old and length(p_new) > p_max then
    raise exception '% is longer than % characters', p_column, p_max using errcode = 'check_violation';
  end if;
end $$;
revoke execute on function private.check_length from public;

create function private.guard_adventure_lengths() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.adventures;
begin
  if tg_op = 'UPDATE' then
    o := old;
  end if;
  perform private.check_length('destination', new.destination, o.destination, 200);
  return new;
end $$;

create trigger guard_adventure_lengths before insert or update of destination on public.adventures
  for each row execute function private.guard_adventure_lengths();

create function private.guard_profile_lengths() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.adventurer_profiles;
begin
  if tg_op = 'UPDATE' then
    o := old;
  end if;
  perform private.check_length('name', new.name, o.name, 100);
  perform private.check_length('car_make', new.car_make, o.car_make, 50);
  perform private.check_length('car_colour', new.car_colour, o.car_colour, 50);
  perform private.check_length('car_plate', new.car_plate, o.car_plate, 20);
  perform private.check_length('medical_notes', new.medical_notes, o.medical_notes, 500);
  return new;
end $$;

create trigger guard_profile_lengths before insert or update on public.adventurer_profiles
  for each row execute function private.guard_profile_lengths();

create function private.guard_contact_lengths() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.emergency_contacts;
begin
  if tg_op = 'UPDATE' then
    o := old;
  end if;
  perform private.check_length('name', new.name, o.name, 100);
  perform private.check_length('email', new.email, o.email, 254);
  return new;
end $$;

create trigger guard_contact_lengths before insert or update on public.emergency_contacts
  for each row execute function private.guard_contact_lengths();

create or replace function private.guard_contact_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.removed_at is null and (tg_op = 'INSERT' or old.removed_at is not null) then
    -- Held until the transaction ends, so a second insert counts the first one.
    perform pg_advisory_xact_lock(hashtextextended('barry.contacts:' || new.adventurer_id::text, 0));
    if (
      select count(*) from public.emergency_contacts
      where adventurer_id = new.adventurer_id and removed_at is null and id <> new.id
    ) >= private.max_contacts() then
      raise exception 'barry:too_many_contacts' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
