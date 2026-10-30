-- The live Adventure screen and each Ended Adventure list the messages that went out to the contacts and those
-- that failed, as they happen. Messages still waiting, and those Barry cancelled, never reached anyone.

-- One message goes to one address, which contacts may share, so the row names every contact of the Adventure on
-- it. An address cannot change while the Adventure is in progress, and the contact it was sent for always counts.
create view public.adventure_messages with (security_invoker = true) as
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
         ) as contacts
  from public.messages m
  where m.status in ('sent', 'failed');

grant select on public.adventure_messages to authenticated;

alter publication supabase_realtime add table public.messages;
