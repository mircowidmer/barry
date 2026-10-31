-- The phone tells the Adventurer when Twilio reports a text message not delivered. A send error, such as text
-- messages being switched off, fails every message the same way and is no report, so the report marks its row.
-- provider_ref cannot tell them apart, because a report can overtake settle_message.

alter table public.messages add column undelivered_at timestamptz;

create or replace function public.report_delivery(p_id bigint, p_provider_ref text, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('delivered', 'undelivered', 'failed') then
    raise exception 'unknown delivery status %', p_status;
  end if;

  -- A report can overtake settle_message, so a row still sending without a provider reference counts too.
  update public.messages
     set delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
         undelivered_at = case when p_status = 'delivered' then undelivered_at else now() end,
         status = case when p_status = 'delivered' then status else 'failed' end::public.message_status,
         failure_reason = case when p_status = 'delivered' then failure_reason else p_reason end,
         lease_until = case when p_status = 'delivered' then lease_until else null end
   where id = p_id and channel = 'sms' and status in ('sending', 'sent')
     and (provider_ref is null or provider_ref = p_provider_ref);
end $$;

create or replace view public.adventure_messages with (security_invoker = true) as
  select m.id, m.adventure_id, m.kind, m.round, m.channel, m.to_address, m.status, m.failure_reason,
         -- Messages settled before settled_at existed fall back to when they were sent or queued.
         case when m.status = 'sent' and m.delivered_at is not null then m.delivered_at
              else coalesce(m.settled_at, m.sent_at, m.created_at) end as outcome_at,
         m.status = 'sent' and m.delivered_at is not null as delivered,
         (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name, c.id), '[]'::jsonb)
            from public.emergency_contacts c
           where c.id = m.contact_id
              or (exists (select 1 from public.adventure_contacts ac where ac.adventure_id = m.adventure_id and ac.contact_id = c.id)
                  and case m.channel when 'email' then lower(c.email) = lower(m.to_address) when 'sms' then c.phone = m.to_address end)
         ) as contacts,
         m.status = 'failed' and m.undelivered_at is not null as undelivered
  from public.messages m
  where m.status in ('sent', 'failed');
