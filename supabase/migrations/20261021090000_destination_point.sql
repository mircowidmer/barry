-- The destination can carry a point on the map. The phone watches a geofence around it and shows
-- the Arrival Notice there. The point is not part of what the contacts are told, so a change to it
-- alone sends no Plan Update.

alter table public.adventures
  add column destination_latitude double precision check (destination_latitude between -90 and 90),
  add column destination_longitude double precision check (destination_longitude between -180 and 180),
  add constraint destination_point_whole check ((destination_latitude is null) = (destination_longitude is null));

drop function public.save_adventure(uuid, text, text, timestamptz, uuid[]);
drop function commands.save_adventure(uuid, text, text, timestamptz, uuid[]);

-- The point comes last, as {"latitude", "longitude"}, and defaults to none, so an app that does not
-- send it yet still saves. One argument instead of two keeps a call with seven untyped arguments
-- going to the old pass-through, which takes a Starting Point and Notes.
create function commands.save_adventure(
  p_id uuid, p_destination text, p_route text, p_deadline timestamptz, p_contact_ids uuid[],
  p_destination_point jsonb default null
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_contacts uuid[] := coalesce(p_contact_ids, '{}');
  a public.adventures;
  v_plan_changed boolean := false;
  v_latitude double precision := (p_destination_point ->> 'latitude')::double precision;
  v_longitude double precision := (p_destination_point ->> 'longitude')::double precision;
begin
  if exists (
    select 1 from unnest(v_contacts) as wanted (id)
    where not exists (
      select 1 from public.emergency_contacts c
      where c.id = wanted.id and c.adventurer_id = v_uid and c.removed_at is null
    )
  ) then
    return query select p_id, 'unknown_contact'::public.refusal;
    return;
  end if;

  if p_id is null then
    insert into public.adventures (adventurer_id, destination, destination_latitude, destination_longitude, route, deadline)
    values (v_uid, p_destination, v_latitude, v_longitude, p_route, p_deadline)
    returning * into a;
  else
    select * into a from public.adventures where id = p_id and adventurer_id = v_uid for update;
    if not found then
      return query select p_id, 'not_found'::public.refusal;
      return;
    end if;
    if a.stage not in ('planned', 'active', 'overdue') then
      return query select a.id, 'wrong_stage'::public.refusal;
      return;
    end if;
    if a.stage <> 'planned' and cardinality(v_contacts) = 0 then
      return query select a.id, 'no_contacts'::public.refusal;
      return;
    end if;
    if a.stage <> 'planned' and coalesce(btrim(p_destination), '') = '' then
      return query select a.id, 'destination_missing'::public.refusal;
      return;
    end if;

    v_plan_changed := a.stage <> 'planned'
      and (a.destination, a.route) is distinct from (p_destination, p_route);

    update public.adventures
       set destination = p_destination, route = p_route,
           destination_latitude = v_latitude, destination_longitude = v_longitude,
           plan_revision = plan_revision + v_plan_changed::int,
           deadline = case when a.stage = 'planned' then p_deadline else deadline end,
           updated_at = now()
     where id = a.id
    returning * into a;
  end if;

  delete from public.adventure_contacts where adventure_id = a.id and contact_id <> all (v_contacts);
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending' and contact_id <> all (v_contacts);

  -- Only contacts whose Heads-up already went out: an unsent Heads-up carries the latest Plan itself.
  if v_plan_changed then
    update public.messages set status = 'cancelled'
     where adventure_id = a.id and kind = 'plan_update' and status = 'pending';
    perform private.enqueue_to_contacts(a.id, 'plan_update', null, a.plan_revision);
    delete from public.messages m
     where m.adventure_id = a.id and m.kind = 'plan_update' and m.plan_revision = a.plan_revision
       and not exists (
         select 1 from public.messages h
         where h.adventure_id = a.id and h.kind = 'heads_up' and h.contact_id = m.contact_id
           and h.status in ('sent', 'failed'));
  end if;
  insert into public.adventure_contacts (adventure_id, contact_id)
  select a.id, unnest(v_contacts)
  on conflict do nothing;

  if a.stage <> 'planned' then
    perform private.reconcile(a.id);
  end if;

  return query select a.id, null::public.refusal;
end $$;

create function public.save_adventure(
  p_id uuid, p_destination text, p_route text, p_deadline timestamptz, p_contact_ids uuid[],
  p_destination_point jsonb default null
) returns table (adventure_id uuid, refusal public.refusal)
language sql set search_path = '' as $$
  select * from commands.save_adventure(p_id, p_destination, p_route, p_deadline, p_contact_ids, p_destination_point)
$$;

revoke execute on function
  commands.save_adventure(uuid, text, text, timestamptz, uuid[], jsonb),
  public.save_adventure(uuid, text, text, timestamptz, uuid[], jsonb)
from public, anon, authenticated;

grant execute on function
  commands.save_adventure(uuid, text, text, timestamptz, uuid[], jsonb),
  public.save_adventure(uuid, text, text, timestamptz, uuid[], jsonb)
to authenticated, service_role;
