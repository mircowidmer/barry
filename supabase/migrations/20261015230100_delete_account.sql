-- Deleting the sign-in cascades to the Profile, the contacts, every Adventure, its Trail, its
-- messages and its Trail Map links.
create function public.delete_account() returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'not_found';
  end if;
  if exists (
    select 1 from public.adventures
    where adventurer_id = v_uid and stage in ('active', 'overdue', 'alerted')
  ) then
    return 'adventure_in_progress';
  end if;
  -- The cascade would silently drop an All-clear still on its way.
  if exists (
    select 1 from public.messages m
    join public.adventures a on a.id = m.adventure_id
    where a.adventurer_id = v_uid and m.status in ('pending', 'sending')
  ) then
    return 'messages_pending';
  end if;
  delete from auth.users where id = v_uid;
  return null;
end $$;

revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;
