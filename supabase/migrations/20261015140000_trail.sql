alter table public.position_readings
  drop constraint position_readings_reason_check,
  add constraint position_readings_reason_check check (reason in ('start', 'deadline_move', 'trail')),
  add column minute timestamptz
    generated always as (date_trunc('minute', taken_at at time zone 'UTC') at time zone 'UTC') stored;

create unique index position_readings_trail_minute
  on public.position_readings (adventure_id, minute) where reason = 'trail';

-- 128 random bits as 22 URL-safe characters: short enough for a text message.
alter table public.adventure_contacts
  add column trail_token text not null unique
    default translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_');

create function public.record_trail(p_id uuid, p_readings jsonb) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  -- for share waits for check_in's for update, so no reading lands after the Trail delete,
  -- while two uploads never wait on each other.
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for share;
  if not found then
    return 'not_found';
  end if;
  if a.stage not in ('active', 'overdue', 'alerted') then
    return 'wrong_stage';
  end if;

  insert into public.position_readings (adventure_id, taken_at, latitude, longitude, accuracy_m, reason)
  select a.id, r.taken_at, r.latitude, r.longitude, r.accuracy_m, 'trail'
    from jsonb_to_recordset(p_readings)
         as r (taken_at timestamptz, latitude double precision, longitude double precision, accuracy_m real)
   where r.taken_at between a.started_at and now() + interval '2 minutes'
     and r.latitude between -90 and 90 and r.longitude between -180 and 180
     and (r.accuracy_m is null or r.accuracy_m >= 0)
   order by r.taken_at
   limit 500
  on conflict (adventure_id, minute) where reason = 'trail' do nothing;

  return null;
end $$;

revoke execute on function public.record_trail from public, anon;
grant execute on function public.record_trail to authenticated;

-- Null for an unknown token, a removed contact and a Planned Adventure alike. The projection is
-- built by hand so the Deadline, the Overdue Stage and the Profile cannot leak.
create function public.trail_map(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'status', case a.stage when 'alerted' then 'alerted' when 'ended' then 'checked_in' else 'underway' end,
           'adventurer_name', p.name,
           'time_zone', a.time_zone,
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route,
                                      'starting_point', a.starting_point, 'notes', a.notes))
         || case when a.stage = 'ended'
              then jsonb_build_object('checked_in_at', a.checked_in_at)
              else jsonb_build_object(
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
                  where r.adventure_id = a.id), '[]'::jsonb))
            end
  from public.adventure_contacts ac
  join public.adventures a on a.id = ac.adventure_id
  join public.adventurer_profiles p on p.id = a.adventurer_id
  where ac.trail_token = p_token and a.stage <> 'planned'
$$;

revoke execute on function public.trail_map from public, authenticated;
grant execute on function public.trail_map to anon;

create or replace function public.check_in(p_id uuid, p_checked_in_at timestamptz) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage = 'planned' then
    return 'wrong_stage';
  end if;
  if a.stage = 'ended' then
    return null;
  end if;

  update public.adventures
     set stage = 'ended', ended_at = now(), updated_at = now(),
         checked_in_at = least(now(), greatest(coalesce(p_checked_in_at, now()), started_at))
   where id = a.id;

  delete from public.position_readings where adventure_id = a.id and reason = 'trail';

  -- Under READ COMMITTED this waits for a row deliver has claimed, rereads it as 'sending' and
  -- leaves it, so an Alert already on its way is never cancelled.
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending'
     and not (kind = 'alert' and attempts > 0);

  if a.stage = 'alerted' then
    perform private.enqueue_all_clear(a.id);
  end if;
  return null;
end $$;

-- Read at send time, so an Alert carries the latest Plan, Last Known Position and Profile.
-- Only the Alert carries the Profile beyond the name. trail_token is null once the contact has
-- left the Adventure, and the message then goes out without the Trail Map link.
create or replace function public.message_facts(p_message_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'kind', m.kind,
           'adventurer_name', p.name,
           'contact_name', c.name,
           'time_zone', a.time_zone,
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route,
                                      'starting_point', a.starting_point, 'notes', a.notes),
           'deadline', coalesce(m.for_deadline, a.deadline))
         || case m.kind
              when 'heads_up' then jsonb_build_object('trail_token', ac.trail_token)
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
              when 'all_clear' then jsonb_build_object('checked_in_at', a.checked_in_at)
              else '{}'::jsonb
            end
  from public.messages m
  join public.adventures a on a.id = m.adventure_id
  left join public.adventurer_profiles p on p.id = a.adventurer_id
  left join public.emergency_contacts c on c.id = m.contact_id
  left join public.adventure_contacts ac on ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id
  where m.id = p_message_id
$$;
