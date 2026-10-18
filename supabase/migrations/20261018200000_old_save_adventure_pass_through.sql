-- A phone that has not fetched the new app yet still sends a Starting Point and Notes. It keeps
-- saving its Plans through this pass-through, which drops both. Remove it in the next release.

create function public.save_adventure(
  p_id uuid, p_destination text, p_route text, p_starting_point text, p_notes text,
  p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language sql set search_path = '' as $$
  select * from commands.save_adventure(p_id, p_destination, p_route, p_deadline, p_contact_ids)
$$;

revoke execute on function public.save_adventure(uuid, text, text, text, text, timestamptz, uuid[])
from public, anon, authenticated;
grant execute on function public.save_adventure(uuid, text, text, text, text, timestamptz, uuid[])
to authenticated, service_role;
