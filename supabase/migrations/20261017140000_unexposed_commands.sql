-- Clears the remaining Supabase security warnings without changing what the app can do.

-- pg_net cannot be relocated, so it is created again in the extensions schema. Its functions stay
-- in the net schema. A wake-up of deliver still queued at this moment is dropped, and the next
-- clock tick sends one again.
drop extension pg_net;
create extension pg_net with schema extensions;

-- The commands run with elevated rights and check the caller themselves. They move unchanged into
-- a schema the API does not expose, and public keeps thin pass-throughs with the same names and
-- parameters, which run with the caller's rights.
create schema commands;
revoke all on schema commands from public;
grant usage on schema commands to anon, authenticated, service_role;

alter function public.check_in(uuid, timestamptz) set schema commands;
alter function public.delete_account() set schema commands;
alter function public.delete_adventure(uuid) set schema commands;
alter function public.enabled_channels() set schema commands;
alter function public.move_deadline(uuid, timestamptz, double precision, double precision, real, timestamptz) set schema commands;
alter function public.record_trail(uuid, jsonb) set schema commands;
alter function public.save_adventure(uuid, text, text, text, text, timestamptz, uuid[]) set schema commands;
alter function public.start_adventure(uuid, text, double precision, double precision, real, timestamptz) set schema commands;
alter function public.trail_map(text, timestamptz) set schema commands;

create function public.check_in(p_id uuid, p_checked_in_at timestamptz) returns public.refusal
language sql set search_path = '' as $$ select commands.check_in(p_id, p_checked_in_at) $$;

create function public.delete_account() returns public.refusal
language sql set search_path = '' as $$ select commands.delete_account() $$;

create function public.delete_adventure(p_id uuid) returns public.refusal
language sql set search_path = '' as $$ select commands.delete_adventure(p_id) $$;

create function public.enabled_channels() returns setof public.channel
language sql stable set search_path = '' as $$ select * from commands.enabled_channels() $$;

create function public.move_deadline(
  p_id uuid, p_deadline timestamptz,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language sql set search_path = '' as $$
  select commands.move_deadline(p_id, p_deadline, p_latitude, p_longitude, p_accuracy_m, p_position_taken_at)
$$;

create function public.record_trail(p_id uuid, p_readings jsonb) returns public.refusal
language sql set search_path = '' as $$ select commands.record_trail(p_id, p_readings) $$;

create function public.save_adventure(
  p_id uuid, p_destination text, p_route text, p_starting_point text, p_notes text,
  p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language sql set search_path = '' as $$
  select * from commands.save_adventure(p_id, p_destination, p_route, p_starting_point, p_notes, p_deadline, p_contact_ids)
$$;

create function public.start_adventure(
  p_id uuid, p_time_zone text,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language sql set search_path = '' as $$
  select commands.start_adventure(p_id, p_time_zone, p_latitude, p_longitude, p_accuracy_m, p_position_taken_at)
$$;

create function public.trail_map(p_token text, p_after timestamptz default null) returns jsonb
language sql stable set search_path = '' as $$ select commands.trail_map(p_token, p_after) $$;

revoke execute on function
  public.check_in(uuid, timestamptz),
  public.delete_account(),
  public.delete_adventure(uuid),
  public.enabled_channels(),
  public.move_deadline(uuid, timestamptz, double precision, double precision, real, timestamptz),
  public.record_trail(uuid, jsonb),
  public.save_adventure(uuid, text, text, text, text, timestamptz, uuid[]),
  public.start_adventure(uuid, text, double precision, double precision, real, timestamptz),
  public.trail_map(text, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.check_in(uuid, timestamptz),
  public.delete_account(),
  public.delete_adventure(uuid),
  public.enabled_channels(),
  public.move_deadline(uuid, timestamptz, double precision, double precision, real, timestamptz),
  public.record_trail(uuid, jsonb),
  public.save_adventure(uuid, text, text, text, text, timestamptz, uuid[]),
  public.start_adventure(uuid, text, double precision, double precision, real, timestamptz)
to authenticated, service_role;

grant execute on function public.trail_map(text, timestamptz) to anon, service_role;
