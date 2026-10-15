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

  if a.stage = 'alerted' then
    perform private.enqueue_all_clear(a.id);
  end if;
  return null;
end $$;
