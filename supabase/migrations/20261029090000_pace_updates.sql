-- One Active Adventure could still make Barry send without bound: every change of the destination sent a Plan
-- Update at once, a Deadline move every 3 minutes sent a Deadline Update, and a contact's address edited in place,
-- or contacts swapped in and out, reached new addresses with a fresh Heads-up each time.

-- An address gets at most one Plan Update and one Deadline Update in this time. Changes in between wait and
-- become one message with the latest Plan or Deadline, as quick changes already did.
create function private.update_pace() returns interval language sql immutable set search_path = '' as $$
  select interval '15 minutes'
$$;

-- Holds the unsent messages of one kind to each address until the pace since the last one sent there has passed.
create function private.pace_updates(p_adventure_id uuid, p_kind public.message_kind, p_not_before timestamptz)
returns void language sql security definer set search_path = '' as $$
  update public.messages m
     set next_attempt_at = greatest(p_not_before, (
           select max(p.created_at) from public.messages p
            where p.adventure_id = m.adventure_id and p.kind = m.kind and p.channel = m.channel
              and p.to_address = m.to_address and p.id <> m.id and p.status <> 'cancelled'
         ) + private.update_pace())
   where m.adventure_id = p_adventure_id and m.kind = p_kind and m.status = 'pending' and m.attempts = 0
$$;
revoke execute on function private.pace_updates(uuid, public.message_kind, timestamptz) from public;

-- The app never changes an address: a contact is deleted and picked again. While an Adventure in progress uses
-- the contact, an address changed in place would reach someone new with every message.
create function private.guard_contact_address() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.email is distinct from old.email or new.phone is distinct from old.phone) and exists (
    select 1 from public.adventure_contacts ac
    join public.adventures a on a.id = ac.adventure_id
    where ac.contact_id = new.id and a.stage in ('active', 'overdue', 'alerted')
  ) then
    raise exception 'barry:contact_in_use' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.guard_contact_address() from public;

create trigger guard_contact_address before update of email, phone on public.emergency_contacts
  for each row execute function private.guard_contact_address();

create or replace function commands.save_adventure(
  p_id uuid, p_destination text, p_deadline timestamptz, p_contact_ids uuid[],
  p_destination_point jsonb default null
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_contacts uuid[] := coalesce(p_contact_ids, '{}');
  a public.adventures;
  v_plan_changed boolean := false;
  v_latitude double precision := (p_destination_point ->> 'latitude')::double precision;
  v_longitude double precision := (p_destination_point ->> 'longitude')::double precision;
begin
  if exists (
    select 1 from unnest(v_contacts) as wanted (id)
    where not exists (
      select 1 from public.emergency_contacts c
      where c.id = wanted.id and c.adventurer_id = v_uid and c.removed_at is null
    )
  ) then
    return query select p_id, 'unknown_contact'::public.refusal;
    return;
  end if;
  if (select count(distinct id) from unnest(v_contacts) as wanted (id)) > private.max_adventure_contacts() then
    return query select p_id, 'too_many_contacts'::public.refusal;
    return;
  end if;

  if p_id is null then
    insert into public.adventures (adventurer_id, destination, destination_latitude, destination_longitude, deadline)
    values (v_uid, p_destination, v_latitude, v_longitude, p_deadline)
    returning * into a;
  else
    select * into a from public.adventures where id = p_id and adventurer_id = v_uid for update;
    if not found then
      return query select p_id, 'not_found'::public.refusal;
      return;
    end if;
    if a.stage not in ('planned', 'active', 'overdue') then
      return query select a.id, 'wrong_stage'::public.refusal;
      return;
    end if;
    if a.stage <> 'planned' and cardinality(v_contacts) = 0 then
      return query select a.id, 'no_contacts'::public.refusal;
      return;
    end if;
    if a.stage <> 'planned' and coalesce(btrim(p_destination), '') = '' then
      return query select a.id, 'destination_missing'::public.refusal;
      return;
    end if;
    -- Counted over the whole Adventure, so swapping contacts in and out cannot reach new addresses without end.
    if (select count(distinct reached.id) from (
          select m.contact_id from public.messages m where m.adventure_id = a.id and m.contact_id is not null
          union select unnest(v_contacts)) as reached (id)) > private.max_contacts() then
      return query select a.id, 'too_many_contacts'::public.refusal;
      return;
    end if;

    v_plan_changed := a.stage <> 'planned'
      and a.destination is distinct from p_destination;

    update public.adventures
       set destination = p_destination,
           destination_latitude = v_latitude, destination_longitude = v_longitude,
           plan_revision = plan_revision + v_plan_changed::int,
           deadline = case when a.stage = 'planned' then p_deadline else deadline end,
           updated_at = now()
     where id = a.id
    returning * into a;
  end if;

  delete from public.adventure_contacts where adventure_id = a.id and contact_id <> all (v_contacts);
  update public.messages set status = 'cancelled'
   where adventure_id = a.id and status = 'pending' and contact_id <> all (v_contacts);

  -- Only contacts whose Heads-up already went out: an unsent Heads-up carries the latest Plan itself.
  if v_plan_changed then
    update public.messages set status = 'cancelled'
     where adventure_id = a.id and kind = 'plan_update' and status = 'pending';
    perform private.enqueue_to_contacts(a.id, 'plan_update', null, a.plan_revision);
    delete from public.messages m
     where m.adventure_id = a.id and m.kind = 'plan_update' and m.plan_revision = a.plan_revision
       and not exists (
         select 1 from public.messages h
         where h.adventure_id = a.id and h.kind = 'heads_up' and h.contact_id = m.contact_id
           and h.status in ('sent', 'failed'));
    perform private.pace_updates(a.id, 'plan_update', now());
  end if;
  insert into public.adventure_contacts (adventure_id, contact_id)
  select a.id, unnest(v_contacts)
  on conflict do nothing;

  if a.stage <> 'planned' then
    perform private.reconcile(a.id);
  end if;

  return query select a.id, null::public.refusal;
end $$;


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

