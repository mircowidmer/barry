-- Each Deadline move after an Alert brought up to three more Alerts to every address, without end. An Adventure now
-- brings at most max_alerts_per_adventure: a move is refused once a moved Deadline's full rounds would pass it, so
-- every Deadline still gets all its Alerts and the phone never announces one that will not go out.

create function private.max_alerts_per_adventure() returns smallint language sql immutable set search_path = '' as $$
  select 9::smallint
$$;

create or replace function commands.move_deadline(
  p_id uuid, p_deadline timestamptz,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language plpgsql security definer set search_path = '' as $$
declare
  a public.adventures;
  v_told jsonb;
begin
  select * into a from public.adventures where id = p_id and adventurer_id = auth.uid() for update;
  if not found then
    return 'not_found';
  end if;
  if a.stage not in ('active', 'overdue', 'alerted') then
    return 'wrong_stage';
  end if;
  if p_deadline = a.deadline then
    return null;
  end if;
  if p_deadline < a.deadline then
    return 'deadline_not_later';
  end if;
  if p_deadline <= now() then
    return 'deadline_not_in_future';
  end if;
  if a.earlier_alerts + a.alerts_sent + private.max_alerts() > private.max_alerts_per_adventure() then
    return 'too_many_alerts';
  end if;

  update public.adventures
     set stage = 'active', deadline = p_deadline, updated_at = now(),
         earlier_alerts = earlier_alerts + alerts_sent, alerts_sent = 0, last_alert_at = null
   where id = a.id;

  -- A Deadline Update not yet attempted gives way to a new one that keeps its earlier time.
  with dropped as (
    delete from public.messages
     where adventure_id = a.id and kind = 'deadline_update' and status = 'pending' and attempts = 0
    returning channel, to_address, previous_deadline
  )
  select coalesce(jsonb_agg(to_jsonb(dropped)), '[]') into v_told from dropped;

  perform private.enqueue_to_contacts(a.id, 'deadline_update', null, null, a.deadline);
  -- Only contacts whose Heads-up already went out: an unsent Heads-up carries the new Deadline itself.
  delete from public.messages m
   where m.adventure_id = a.id and m.kind = 'deadline_update' and m.previous_deadline = a.deadline
     and not exists (
       select 1 from public.messages h
       where h.adventure_id = a.id and h.kind = 'heads_up' and h.contact_id = m.contact_id
         and h.status in ('sent', 'failed'));
  update public.messages m
     set previous_deadline = (t ->> 'previous_deadline')::timestamptz
    from jsonb_array_elements(v_told) t
   where m.adventure_id = a.id and m.kind = 'deadline_update' and m.previous_deadline = a.deadline
     and m.channel::text = t ->> 'channel' and m.to_address = t ->> 'to_address';
  perform private.pace_updates(a.id, 'deadline_update', now() + private.deadline_update_delay());

  perform private.record_position(a.id, 'deadline_move', p_latitude, p_longitude, p_accuracy_m, p_position_taken_at);
  perform private.reconcile(a.id);
  return null;
end $$;
