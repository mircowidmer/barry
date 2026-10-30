-- 20261029090000_pace_updates.sql paced an update from when the previous one to the address was created, not from
-- when it went out. A paced update is created at once but sent up to 15 minutes later, so the next change right
-- after that send could go out within a minute of it. The pace now counts from when the previous update was sent,
-- or, for one still waiting, from when it is due.
create or replace function private.pace_updates(p_adventure_id uuid, p_kind public.message_kind, p_not_before timestamptz)
returns void language sql security definer set search_path = '' as $$
  update public.messages m
     set next_attempt_at = greatest(p_not_before, (
           select max(coalesce(p.sent_at, greatest(p.created_at, p.next_attempt_at))) from public.messages p
            where p.adventure_id = m.adventure_id and p.kind = m.kind and p.channel = m.channel
              and p.to_address = m.to_address and p.id <> m.id and p.status <> 'cancelled'
         ) + private.update_pace())
   where m.adventure_id = p_adventure_id and m.kind = p_kind and m.status = 'pending' and m.attempts = 0
$$;
revoke execute on function private.pace_updates(uuid, public.message_kind, timestamptz) from public;
