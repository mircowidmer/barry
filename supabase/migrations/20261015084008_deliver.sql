create extension if not exists pg_net;

create function private.max_attempts() returns smallint language sql immutable as $$ select 6::smallint $$;

create function private.retry_backoff(p_attempts smallint) returns interval language sql immutable as $$
  select case p_attempts
    when 1 then interval '30 seconds'
    when 2 then interval '1 minute'
    when 3 then interval '2 minutes'
    when 4 then interval '5 minutes'
    else interval '10 minutes'
  end
$$;

create function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')
returns setof public.messages language plpgsql security definer set search_path = '' as $$
begin
  -- A command cancels what it makes stale, but a row that was being sent at that moment can
  -- come back as a retry afterwards. Never an Alert: only check_in decides about those.
  update public.messages m set status = 'cancelled'
    from public.adventures a
   where a.id = m.adventure_id and m.status = 'pending' and (
         (m.kind = 'heads_up' and (a.stage = 'ended' or not exists (
            select 1 from public.adventure_contacts ac
            where ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id)))
      or (m.kind in ('reminder', 'overdue_notice') and (a.stage = 'ended' or m.for_deadline <> a.deadline)));

  update public.messages set status = 'failed', failure_reason = 'retries_exhausted', lease_until = null
   where status = 'sending' and lease_until < now() and attempts >= private.max_attempts();

  update public.messages m set status = 'cancelled', failure_reason = 'no_alert_delivered'
   where m.kind = 'all_clear' and m.status = 'pending'
     and not exists (
       select 1 from public.messages e
       where e.adventure_id = m.adventure_id and e.kind = 'alert'
         and e.channel = m.channel and e.to_address = m.to_address
         and e.status in ('pending', 'sending', 'sent'));

  -- Per address: Alert round n waits for round n - 1, and an All-clear waits for every Alert.
  -- Nothing else blocks, so an Alert overtakes a Heads-up in retry backoff.
  return query
  with due as (
    select m.id from public.messages m
    where ((m.status = 'pending' and m.next_attempt_at <= now())
           or (m.status = 'sending' and m.lease_until < now()))
      and not exists (
        select 1 from public.messages e
        where e.adventure_id = m.adventure_id and e.channel = m.channel
          and e.to_address = m.to_address and e.id <> m.id
          and e.status in ('pending', 'sending')
          and ((m.kind = 'all_clear' and e.kind = 'alert')
               or (m.kind = 'alert' and e.kind = 'alert' and e.round < m.round)))
    order by m.id
    limit p_limit
    for update skip locked
  )
  update public.messages m
     set status = 'sending', lease_until = now() + p_lease, attempts = m.attempts + 1
    from due
   where m.id = due.id
  returning m.*;
end $$;

-- A report for an attempt that already lost its lease matches no row, so it is ignored.
create function public.settle_message(
  p_id bigint, p_attempt smallint, p_outcome text,
  p_provider_ref text default null, p_reason text default null, p_retry_after interval default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome not in ('sent', 'retry', 'failed') then
    raise exception 'unknown outcome %', p_outcome;
  end if;

  update public.messages
     set status = case
                    when p_outcome = 'sent' then 'sent'
                    when p_outcome = 'failed' or attempts >= private.max_attempts() then 'failed'
                    else 'pending'
                  end::public.message_status,
         sent_at = case when p_outcome = 'sent' then now() else sent_at end,
         provider_ref = coalesce(p_provider_ref, provider_ref),
         failure_reason = case
                            when p_outcome = 'sent' then null
                            when p_outcome = 'retry' and attempts >= private.max_attempts() then 'retries_exhausted'
                            else p_reason
                          end,
         next_attempt_at = case
                             when p_outcome = 'retry' then now() + coalesce(p_retry_after, private.retry_backoff(attempts))
                             else next_attempt_at
                           end,
         lease_until = null
   where id = p_id and attempts = p_attempt and status = 'sending';
end $$;

-- Read at send time, so an Alert carries the latest Plan, Last Known Position and Profile.
-- Only the Alert carries the Profile beyond the name.
create function public.message_facts(p_message_id bigint) returns jsonb
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
              when 'alert' then jsonb_build_object(
                'round', m.round,
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
  where m.id = p_message_id
$$;

create function public.health()
returns table (clock_ok boolean, adventures_ok boolean, outbox_ok boolean)
language sql stable security definer set search_path = '' as $$
  select
    coalesce((select last_tick_at > now() - interval '2 minutes' from private.clock_status), false),
    not exists (select 1 from private.tick_error where at > now() - interval '2 minutes'),
    not exists (
      select 1 from public.messages
      where (status = 'pending' and next_attempt_at < now() - interval '5 minutes')
         or (status = 'sending' and lease_until < now() - interval '5 minutes'))
$$;

revoke execute on function public.claim_messages, public.settle_message, public.message_facts, public.health
  from public, anon, authenticated;
grant execute on function public.claim_messages, public.settle_message, public.message_facts, public.health
  to service_role;

-- pg_net queues the request in a table, so a rolled-back transaction wakes nothing.
create function private.kick_deliverer() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'deliver_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'deliver_secret');
begin
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end $$;

create function private.kick_on_new_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from inserted) then
    perform private.kick_deliverer();
  end if;
  return null;
end $$;

create trigger kick_deliverer after insert on public.messages
  referencing new table as inserted
  for each statement execute function private.kick_on_new_messages();

-- tick also wakes deliver every minute, which picks up retries and sends the heartbeat.
create or replace function private.tick(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select id from public.adventures
    where stage in ('active', 'overdue', 'alerted')
      and deadline <= p_now + private.reminder_lead()
      and not (stage = 'alerted' and alerts_sent >= private.max_alerts())
    for update skip locked
  loop
    begin
      perform private.reconcile(r.id, p_now);
    exception when others then
      insert into private.tick_error (at, adventure_id, sqlstate, message)
      values (p_now, r.id, sqlstate, sqlerrm);
    end;
  end loop;

  insert into private.clock_status (id, last_tick_at) values (true, p_now)
  on conflict (id) do update set last_tick_at = excluded.last_tick_at;

  perform private.kick_deliverer();
end $$;
