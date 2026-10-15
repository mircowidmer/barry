alter type public.refusal add value 'messages_pending';

create or replace function public.delete_adventure(p_id uuid) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage not in ('planned', 'ended') then
    return 'wrong_stage';
  end if;
  -- The delete cascades to messages, so it would silently drop an All-clear still on its way.
  if exists (select 1 from public.messages where adventure_id = a.id and status in ('pending', 'sending')) then
    return 'messages_pending';
  end if;
  delete from public.adventures where id = a.id;
  return null;
end $$;
