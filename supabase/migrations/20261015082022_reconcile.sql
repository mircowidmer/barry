-- One row per channel the contact has and Barry has enabled. A contact with no enabled channel
-- gets exactly one row born failed, so the Adventurer sees a Delivery Failure instead of silence.
create function private.enqueue_to_contacts(p_adventure_id uuid, p_kind public.message_kind, p_round smallint)
returns void language sql security definer set search_path = '' as $$
  with reach as (
    select c.id as contact_id, ch.channel, ch.address, cfg.enabled
    from public.adventure_contacts ac
    join public.emergency_contacts c on c.id = ac.contact_id
    cross join lateral (values ('email'::public.channel, c.email), ('sms'::public.channel, c.phone)) ch (channel, address)
    join private.channel_config cfg on cfg.channel = ch.channel
    where ac.adventure_id = p_adventure_id and ch.address is not null
  )
  insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id, status, failure_reason)
  select p_adventure_id, p_kind, p_round, r.channel, r.address, r.contact_id,
         case when r.enabled then 'pending' else 'failed' end::public.message_status,
         case when r.enabled then null else 'channel_not_enabled' end
  from reach r
  where r.enabled
     or (not exists (select 1 from reach o where o.contact_id = r.contact_id and o.enabled)
         and r.channel = (select min(o.channel) from reach o where o.contact_id = r.contact_id))
  on conflict on constraint messages_once do update
    set status = 'pending', attempts = 0, next_attempt_at = now(), lease_until = null
    where public.messages.status = 'cancelled' and public.messages.kind = 'heads_up'
$$;

create function private.enqueue_push(p_adventure_id uuid, p_kind public.message_kind)
returns void language sql security definer set search_path = '' as $$
  insert into public.messages (adventure_id, kind, channel, to_address, for_deadline)
  select a.id, p_kind, 'push', d.expo_push_token, a.deadline
  from public.adventures a
  join public.push_devices d on d.adventurer_id = a.adventurer_id
  join private.channel_config cfg on cfg.channel = 'push' and cfg.enabled
  where a.id = p_adventure_id
  on conflict on constraint messages_once do nothing
$$;

create function private.reconcile(p_adventure_id uuid, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
  d private.clock_decision;
begin
  select * into a from public.adventures where id = p_adventure_id for update;
  if not found or a.stage not in ('active', 'overdue', 'alerted') then
    return;
  end if;

  perform private.enqueue_to_contacts(a.id, 'heads_up', null);

  -- decide() owes a Reminder or an Overdue Notice on every call in its window, so only a
  -- Stage change continues the loop.
  loop
    d := private.decide(a.stage, a.deadline, a.deadline_set_at, a.alerts_sent, a.last_alert_at, p_now);

    if d.next_stage is not null or d.alert_round is not null then
      update public.adventures
         set stage = coalesce(d.next_stage, stage),
             alerts_sent = coalesce(d.alert_round, alerts_sent),
             last_alert_at = case when d.alert_round is null then last_alert_at else p_now end,
             updated_at = p_now
       where id = a.id
      returning * into a;
    end if;

    if d.owe_reminder then
      perform private.enqueue_push(a.id, 'reminder');
    end if;
    if d.owe_overdue_notice then
      perform private.enqueue_push(a.id, 'overdue_notice');
    end if;
    if d.alert_round is not null then
      perform private.enqueue_to_contacts(a.id, 'alert', d.alert_round);
    end if;

    exit when d.next_stage is null;
  end loop;
end $$;
