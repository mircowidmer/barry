-- An Adventurer can switch a contact's email address and phone number off without deleting them.
-- Barry reaches a contact only on the addresses that are switched on, and a contact needs at
-- least one address that is filled in and switched on.

alter table public.emergency_contacts
  add column email_enabled boolean not null default true,
  add column phone_enabled boolean not null default true,
  drop constraint emergency_contacts_check,
  add constraint emergency_contacts_reachable
    check ((email is not null and email_enabled) or (phone is not null and phone_enabled));

grant update (email_enabled, phone_enabled) on public.emergency_contacts to authenticated;

create or replace function private.enqueue_to_contacts(
  p_adventure_id uuid, p_kind public.message_kind, p_round smallint, p_plan_revision integer default null
)
returns void language sql security definer set search_path = '' as $$
  with reach as (
    select c.id as contact_id, ch.channel, ch.address, cfg.enabled
    from public.adventure_contacts ac
    join public.emergency_contacts c on c.id = ac.contact_id
    cross join lateral (values
      ('email'::public.channel, c.email, c.email_enabled),
      ('sms'::public.channel, c.phone, c.phone_enabled)
    ) ch (channel, address, switched_on)
    join private.channel_config cfg on cfg.channel = ch.channel
    where ac.adventure_id = p_adventure_id and ch.address is not null and ch.switched_on
  )
  insert into public.messages (adventure_id, kind, round, plan_revision, channel, to_address, contact_id, status, failure_reason)
  select distinct on (r.channel, r.address)
         p_adventure_id, p_kind, p_round, p_plan_revision, r.channel, r.address, r.contact_id,
         case when r.enabled then 'pending' else 'failed' end::public.message_status,
         case when r.enabled then null else 'channel_not_enabled' end
  from reach r
  where r.enabled
     or (not exists (select 1 from reach o where o.contact_id = r.contact_id and o.enabled)
         and r.channel = (select min(o.channel) from reach o where o.contact_id = r.contact_id))
  order by r.channel, r.address, r.contact_id
  on conflict on constraint messages_once do update
    set status = 'pending', attempts = 0, next_attempt_at = now(), lease_until = null
    where public.messages.status = 'cancelled' and public.messages.kind = 'heads_up'
$$;
