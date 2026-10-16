-- Every Check-in sends the All-clear to every contact address, also when no Alert went out.

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

  -- Under READ COMMITTED this waits for a row deliver has claimed, rereads it as 'sending' and
  -- leaves it, so an Alert already on its way is never cancelled.
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending'
     and not (kind = 'alert' and attempts > 0);

  perform private.enqueue_to_contacts(a.id, 'all_clear', null);
  return null;
end $$;

drop function private.enqueue_all_clear(uuid);

create or replace function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')
returns setof public.messages language plpgsql security definer set search_path = '' as $$
begin
  -- A command cancels what it makes stale, but a row that was being sent at that moment can
  -- come back as a retry afterwards. Never an Alert: only check_in decides about those.
  update public.messages m set status = 'cancelled'
    from public.adventures a
   where a.id = m.adventure_id and m.status = 'pending' and (
         (m.kind in ('heads_up', 'plan_update') and (a.stage = 'ended' or not exists (
            select 1 from public.adventure_contacts ac
            where ac.adventure_id = m.adventure_id and ac.contact_id = m.contact_id)))
      or (m.kind in ('reminder', 'overdue_notice') and (a.stage = 'ended' or m.for_deadline <> a.deadline)));

  update public.messages set status = 'failed', failure_reason = 'retries_exhausted', lease_until = null
   where status = 'sending' and lease_until < now() and attempts >= private.max_attempts();

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
