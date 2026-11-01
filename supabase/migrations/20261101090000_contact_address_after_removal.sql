-- A contact removed from an Adventure in progress and added back counts as one contact towards the limit, so an
-- address changed while it was out would reach someone new with each round. Its address now stays as long as an
-- Adventure in progress has sent it a message, not only while that Adventure links it.
create or replace function private.guard_contact_address() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.email is distinct from old.email or new.phone is distinct from old.phone) and (
    exists (
      select 1 from public.adventure_contacts ac
      join public.adventures a on a.id = ac.adventure_id
      where ac.contact_id = new.id and a.stage in ('active', 'overdue', 'alerted')
    ) or exists (
      select 1 from public.messages m
      join public.adventures a on a.id = m.adventure_id
      where m.contact_id = new.id and a.stage in ('active', 'overdue', 'alerted')
    )
  ) then
    raise exception 'barry:contact_in_use' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.guard_contact_address() from public;
