-- Start on a Plan with unsaved changes used to save it in one call and start it in a second, so a refused Start
-- left the save behind, and on a new Plan a Planned Adventure the Adventurer never saved. One command now does both
-- in one transaction: when the save or the Start refuses, nothing it changed is kept.

create function commands.save_and_start_adventure(
  p_id uuid, p_destination text, p_deadline timestamptz, p_contact_ids uuid[], p_time_zone text,
  p_destination_point jsonb default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
declare
  v_saved record;
  v_refusal public.refusal;
begin
  begin
    select * into v_saved
      from commands.save_adventure(p_id, p_destination, p_deadline, p_contact_ids, p_destination_point);
    v_refusal := v_saved.refusal;
    if v_refusal is null then
      v_refusal := commands.start_adventure(
        v_saved.adventure_id, p_time_zone, p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
    end if;
    if v_refusal is not null then
      raise exception using errcode = 'BR001';
    end if;
  exception when sqlstate 'BR001' then
    return query select p_id, v_refusal;
    return;
  end;
  return query select v_saved.adventure_id, null::public.refusal;
end $$;

create function public.save_and_start_adventure(
  p_id uuid, p_destination text, p_deadline timestamptz, p_contact_ids uuid[], p_time_zone text,
  p_destination_point jsonb default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns table (adventure_id uuid, refusal public.refusal)
language sql set search_path = '' as $$
  select * from commands.save_and_start_adventure(
    p_id, p_destination, p_deadline, p_contact_ids, p_time_zone, p_destination_point,
    p_latitude, p_longitude, p_accuracy_m, p_position_taken_at)
$$;

revoke execute on function
  commands.save_and_start_adventure(uuid, text, timestamptz, uuid[], text, jsonb, double precision, double precision, real, timestamptz),
  public.save_and_start_adventure(uuid, text, timestamptz, uuid[], text, jsonb, double precision, double precision, real, timestamptz)
from public, anon, authenticated;

grant execute on function
  commands.save_and_start_adventure(uuid, text, timestamptz, uuid[], text, jsonb, double precision, double precision, real, timestamptz),
  public.save_and_start_adventure(uuid, text, timestamptz, uuid[], text, jsonb, double precision, double precision, real, timestamptz)
to authenticated, service_role;
