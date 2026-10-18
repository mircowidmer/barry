-- A Plan no longer has a Starting Point or Notes. Their values are deleted with the columns.

drop function public.save_adventure(uuid, text, text, text, text, timestamptz, uuid[]);
drop function commands.save_adventure(uuid, text, text, text, text, timestamptz, uuid[]);

create function commands.save_adventure(
  p_id uuid, p_destination text, p_route text, p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_contacts uuid[] := coalesce(p_contact_ids, '{}');
  a public.adventures;
  v_plan_changed boolean := false;
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
    insert into public.adventures (adventurer_id, destination, route, deadline)
    values (v_uid, p_destination, p_route, p_deadline)
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
  p_id uuid, p_destination text, p_route text, p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language sql set search_path = '' as $$
  select * from commands.save_adventure(p_id, p_destination, p_route, p_deadline, p_contact_ids)
$$;

revoke execute on function
  commands.save_adventure(uuid, text, text, timestamptz, uuid[]),
  public.save_adventure(uuid, text, text, timestamptz, uuid[])
from public, anon, authenticated;

grant execute on function
  commands.save_adventure(uuid, text, text, timestamptz, uuid[]),
  public.save_adventure(uuid, text, text, timestamptz, uuid[])
to authenticated, service_role;

create or replace function commands.trail_map(p_token text, p_after timestamptz default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'status', case a.stage when 'alerted' then 'alerted' when 'ended' then 'checked_in' else 'underway' end,
           'adventurer_name', p.name,
           'time_zone', a.time_zone,
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route),
           'last_known_position', (
             select jsonb_build_object('taken_at', r.taken_at, 'latitude', r.latitude,
                                       'longitude', r.longitude, 'accuracy_m', r.accuracy_m)
             from public.position_readings r
             where r.adventure_id = a.id
             order by r.taken_at desc
             limit 1),
           'trail', coalesce((
             select jsonb_agg(jsonb_build_array(r.latitude, r.longitude, r.taken_at) order by r.taken_at)
             from public.position_readings r
             where r.adventure_id = a.id and (p_after is null or r.taken_at > p_after)), '[]'::jsonb))
         || case when a.stage = 'ended' then jsonb_build_object('checked_in_at', a.checked_in_at) else '{}'::jsonb end
  from public.adventure_contacts ac
  join public.adventures a on a.id = ac.adventure_id
  join public.adventurer_profiles p on p.id = a.adventurer_id
  where ac.trail_token = p_token and a.stage <> 'planned'
$$;

create or replace function public.message_facts(p_message_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'kind', m.kind,
           'adventurer_name', p.name,
           'contact_name', c.name,
           'time_zone', a.time_zone,
           'language', coalesce(p.message_language, 'en'),
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route),
           'deadline', coalesce(m.for_deadline, a.deadline))
         || case m.kind
              when 'heads_up' then jsonb_build_object('trail_token', ac.trail_token)
              when 'plan_update' then jsonb_build_object('trail_token', ac.trail_token)
              when 'deadline_update' then jsonb_build_object('trail_token', ac.trail_token,
                                                             'previous_deadline', m.previous_deadline)
              when 'alert' then jsonb_build_object(
                'round', m.round,
                'trail_token', ac.trail_token,
                'profile', jsonb_build_object('phone', p.phone, 'car_make', p.car_make, 'car_colour', p.car_colour,
                                              'car_plate', p.car_plate, 'medical_notes', p.medical_notes),
                'last_known_position', (
                  select jsonb_build_object('taken_at', r.taken_at, 'latitude', r.latitude,
                                            'longitude', r.longitude, 'accuracy_m', r.accuracy_m)
                  from public.position_readings r
                  where r.adventure_id = a.id
                  order by r.taken_at desc
                  limit 1))
              when 'overdue_notice' then jsonb_build_object('alert_at', private.alert_time(m.for_deadline))
              when 'all_clear' then jsonb_build_object('checked_in_at', a.checked_in_at, 'trail_token', ac.trail_token)
              else '{}'::jsonb
            end
  from public.messages m
  join public.adventures a on a.id = m.adventure_id
  left join public.adventurer_profiles p on p.id = a.adventurer_id
  left join public.emergency_contacts c on c.id = m.contact_id
  left join public.adventure_contacts ac on ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id
  where m.id = p_message_id
$$;

alter table public.adventures drop column starting_point, drop column notes;
