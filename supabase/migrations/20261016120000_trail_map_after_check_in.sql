-- After the Check-in the Trail Map keeps showing the Trail. record_trail refuses readings once the
-- Adventure has ended, so the Trail stops at the Check-in.
create or replace function public.trail_map(p_token text, p_after timestamptz default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'status', case a.stage when 'alerted' then 'alerted' when 'ended' then 'checked_in' else 'underway' end,
           'adventurer_name', p.name,
           'time_zone', a.time_zone,
           'plan', jsonb_build_object('destination', a.destination, 'route', a.route,
                                      'starting_point', a.starting_point, 'notes', a.notes),
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
