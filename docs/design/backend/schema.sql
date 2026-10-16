-- Barry backend: sketch migration. Rationale in docs/design/backend/design.md.
--
-- Shape in one paragraph:
--   * The app writes directly ONLY to rows the clock never reads: adventurer_profiles,
--     emergency_contacts, push_devices. Every Adventure write goes through five `public`
--     command RPCs (security definer). adventures, adventure_contacts, position_readings and
--     messages are SELECT-only for the app.
--   * Every table starts with no privileges for anon and authenticated, and default privileges
--     are revoked too, so a table or function someone adds later without a grant fails closed.
--   * pg_cron runs private.tick() every minute INSIDE Postgres. tick() moves Stages and
--     inserts message rows in the same transaction. No network hop sits between "the Deadline
--     passed" and "the Alert is owed".
--   * Messages are rows in public.messages (one row = one message to one address on one
--     channel). A unique key makes every enqueue idempotent (insert ... on conflict).
--   * The `deliver` Edge Function drains the table: claim with a lease, render, send, settle.
--     pg_net kicks it after every command and every tick, and it sends the heartbeat to the
--     outside monitor after checking public.health(). It reaches Postgres only through
--     supabase-js with the service role key, calling service_role-only public functions.
--
-- Requires: pg_cron, pg_net, supabase_vault. pgTAP for the tests.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;          -- not in [api].schemas, so not reachable over PostgREST
revoke all on schema private from public, anon, authenticated;

-- Fail closed: anything created from here on starts with no grants for the app's roles.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

------------------------------------------------------------------------------------------
-- Enums. The single source of truth; `supabase gen types` exports them to TS.
------------------------------------------------------------------------------------------

create type public.adventure_stage as enum ('planned', 'active', 'overdue', 'alerted', 'ended');

create type public.message_kind as enum ('heads_up', 'reminder', 'overdue_notice', 'alert', 'all_clear');

-- 'sms' exists from day one. private.channel_config decides whether Barry sends on it.
create type public.channel as enum ('email', 'sms', 'push');

create type public.message_status as enum ('pending', 'sending', 'sent', 'failed', 'cancelled');

-- Every reason a command RPC can refuse. Returned (not raised) by the RPCs, so the
-- generated TS types carry the exact list and the client never hand-syncs it.
create type public.refusal as enum (
  'not_found',
  'profile_incomplete',
  'destination_missing',
  'deadline_missing',
  'deadline_not_in_future',
  'deadline_not_later',            -- a move must be strictly later than the current Deadline
  'no_contacts',
  'unknown_contact',               -- a contact id that is not the caller's, or was removed
  'another_adventure_in_progress',
  'wrong_stage',                   -- e.g. edit after the Alert, delete after Start, Check-in while Planned
  'invalid_time_zone'
);

------------------------------------------------------------------------------------------
-- Adventurer Profile, Emergency Contacts, push devices (app writes directly, own rows only)
------------------------------------------------------------------------------------------

-- A row exists only once name and phone are known, so "Profile complete" == "row exists".
create table public.adventurer_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null check (length(btrim(name)) > 0),
  phone          text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),   -- E.164
  car_make       text,
  car_colour     text,
  car_plate      text,
  medical_notes  text,
  updated_at     timestamptz not null default now()
);

create table public.emergency_contacts (
  id             uuid primary key default gen_random_uuid(),
  adventurer_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (length(btrim(name)) > 0),
  phone          text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email          text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Soft delete: Ended Adventures and sent messages keep pointing at the contact.
  removed_at     timestamptz,
  created_at     timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index on public.emergency_contacts (adventurer_id) where removed_at is null;

create table public.push_devices (
  expo_push_token text primary key,
  adventurer_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at      timestamptz not null default now()
);
create index on public.push_devices (adventurer_id);

-- Constants live here and only here. deliver never re-derives them: message_facts() hands it
-- the computed Alert time for an Overdue Notice.
create function private.grace_period()   returns interval language sql immutable as $$ select interval '30 minutes' $$;
create function private.reminder_lead()  returns interval language sql immutable as $$ select interval '30 minutes' $$;
create function private.alert_interval() returns interval language sql immutable as $$ select interval '1 hour' $$;
create function private.max_alerts()     returns smallint language sql immutable as $$ select 3::smallint $$;

-- Which channels Barry sends on. The app reads it only through public.enabled_channels().
-- Adding text messages = ship an sms sender in deliver's Record<Channel, Sender>, then flip sms to true.
create table private.channel_config (
  channel  public.channel primary key,
  enabled  boolean not null
);
insert into private.channel_config values ('email', true), ('sms', false), ('push', true);

------------------------------------------------------------------------------------------
-- Adventures (app: SELECT only; writes via RPC)
------------------------------------------------------------------------------------------

create table public.adventures (
  id               uuid primary key default gen_random_uuid(),
  -- Cascades, but private.guard_account_delete() refuses the delete while an Adventure is in progress.
  adventurer_id    uuid not null references auth.users (id) on delete cascade,
  stage            public.adventure_stage not null default 'planned',

  -- Plan
  destination      text,                 -- required to Start, not to save
  route            text,
  starting_point   text,
  notes            text,

  deadline         timestamptz,          -- required to Start
  -- The Overdue screen and the Overdue Notice both read this; the Grace Period exists once.
  alert_at         timestamptz generated always as (deadline + private.grace_period()) stored,
  deadline_set_at  timestamptz,          -- when Start or a move set the current Deadline; gates the Reminder
  time_zone        text,                 -- IANA name, fixed at Start; every time in a message uses it

  started_at       timestamptz,
  alerts_sent      smallint not null default 0 check (alerts_sent between 0 and 3),
  last_alert_at    timestamptz,
  checked_in_at    timestamptz,          -- the gesture time, clamped into [started_at, ended_at]
  ended_at         timestamptz,          -- when Supabase received the Check-in

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Stage <-> timestamps consistency. The enum is the source of truth; these keep it honest.
  check ((stage = 'planned') = (started_at is null)),
  check (stage = 'planned' or (deadline is not null and deadline_set_at is not null
                               and time_zone is not null and destination is not null)),
  check ((stage = 'ended') = (ended_at is not null and checked_in_at is not null)),
  check (checked_in_at is null or checked_in_at between started_at and ended_at),
  check ((alerts_sent > 0) = (last_alert_at is not null)),
  check (stage <> 'alerted' or alerts_sent >= 1),
  check (stage in ('alerted', 'ended') or alerts_sent = 0)
);

-- At most one Active, Overdue or Alerted Adventure per Adventurer.
create unique index adventures_one_in_progress
  on public.adventures (adventurer_id)
  where stage in ('active', 'overdue', 'alerted');

-- The tick's access pattern: "in-progress Adventures whose next clock event is due".
-- The earliest event of any in-progress Adventure is deadline - 30 min, so a range scan on
-- deadline over the partial index finds every candidate. No cached next_wake_at column.
create index adventures_clock
  on public.adventures (deadline)
  where stage in ('active', 'overdue', 'alerted');

create index on public.adventures (adventurer_id, created_at desc);

create table public.adventure_contacts (
  adventure_id  uuid not null references public.adventures (id) on delete cascade,
  contact_id    uuid not null references public.emergency_contacts (id),
  added_at      timestamptz not null default now(),
  primary key (adventure_id, contact_id)
);
create index on public.adventure_contacts (contact_id);

-- Append-only. Last Known Position = latest row by taken_at. Derived, never copied.
create table public.position_readings (
  id            bigint generated always as identity primary key,
  adventure_id  uuid not null references public.adventures (id) on delete cascade,
  taken_at      timestamptz not null,
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  accuracy_m    real check (accuracy_m >= 0),
  reason        text not null check (reason in ('start', 'deadline_move'))
);
create index on public.position_readings (adventure_id, taken_at desc);

------------------------------------------------------------------------------------------
-- Messages: the outbox. Written only by private.* functions; read by `deliver` and (own
-- rows, through delivery_failures) by the app.
------------------------------------------------------------------------------------------

create table public.messages (
  id               bigint generated always as identity primary key,
  adventure_id     uuid not null references public.adventures (id) on delete cascade,
  kind             public.message_kind not null,
  channel          public.channel not null,
  to_address       text not null,          -- email, E.164 phone, or Expo push token (snapshot at enqueue)
  contact_id       uuid references public.emergency_contacts (id),   -- null for the Adventurer's push messages
  round            smallint,               -- Alert 1..3; null otherwise
  for_deadline     timestamptz,            -- Reminder and Overdue Notice: which Deadline it is about

  status           public.message_status not null default 'pending',
  attempts         smallint not null default 0,
  next_attempt_at  timestamptz not null default now(),
  lease_until      timestamptz,
  sent_at          timestamptz,
  provider_ref     text,
  -- 'channel_not_enabled' | 'retries_exhausted' | 'no_alert_delivered' | provider reason
  failure_reason   text,
  created_at       timestamptz not null default now(),

  check ((kind = 'alert') = (round is not null)),
  check (round is null or round between 1 and 3),
  check ((kind in ('reminder', 'overdue_notice')) = (for_deadline is not null)),
  check ((kind in ('reminder', 'overdue_notice')) = (channel = 'push')),
  check ((channel = 'push') = (contact_id is null)),

  -- THE idempotency key. Any enqueue path may run twice; the second insert is a no-op.
  --   Heads-up:        (adventure, heads_up, email|sms, address)          once per address
  --   Alert round n:   (adventure, alert, n, channel, address)
  --   All-clear:       (adventure, all_clear, channel, address)
  --   Reminder:        (adventure, reminder, deadline, push, token)       re-arms when the Deadline moves
  --   Overdue Notice:  (adventure, overdue_notice, deadline, push, token)
  constraint messages_once unique nulls not distinct
    (adventure_id, kind, round, for_deadline, channel, to_address)
);

-- deliver's claim query and its per-address ordering check
create index messages_due on public.messages (next_attempt_at) where status in ('pending', 'sending');
create index on public.messages (adventure_id, channel, to_address, kind) where status in ('pending', 'sending');

-- A Delivery Failure is a status, not a table. Push messages are excluded: the spec limits
-- Delivery Failures to messages for Emergency Contacts.
create view public.delivery_failures with (security_invoker = true) as
  select m.id, m.adventure_id, m.kind, m.channel, m.to_address, m.contact_id,
         c.name as contact_name, m.round, m.failure_reason, m.created_at
  from public.messages m
  left join public.emergency_contacts c on c.id = m.contact_id
  where m.status = 'failed' and m.kind in ('heads_up', 'alert', 'all_clear');

-- Clock liveness and per-Adventure tick errors, read by public.health().
create table private.clock_status (
  id            boolean primary key default true check (id),
  last_tick_at  timestamptz not null
);

create table private.tick_error (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  adventure_id  uuid,
  sqlstate      text,
  message       text
);
create index on private.tick_error (at desc);

------------------------------------------------------------------------------------------
-- Row-level security and grants: no privileges, then exactly what the app needs.
------------------------------------------------------------------------------------------

alter table public.adventurer_profiles enable row level security;
alter table public.emergency_contacts  enable row level security;
alter table public.push_devices        enable row level security;
alter table public.adventures          enable row level security;
alter table public.adventure_contacts  enable row level security;
alter table public.position_readings   enable row level security;
alter table public.messages            enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Direct writes: Profile, contacts (no DELETE: removal is `set removed_at`), push devices.
grant select, insert, update on public.adventurer_profiles to authenticated;
grant select, insert on public.emergency_contacts to authenticated;
grant update (name, phone, email, removed_at) on public.emergency_contacts to authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;
-- Read only. Every write goes through a command RPC or the clock.
grant select on public.adventures, public.adventure_contacts, public.position_readings,
  public.messages, public.delivery_failures to authenticated;

create policy own on public.adventurer_profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy own on public.emergency_contacts for all to authenticated
  using (adventurer_id = (select auth.uid())) with check (adventurer_id = (select auth.uid()));
create policy own on public.push_devices for all to authenticated
  using (adventurer_id = (select auth.uid())) with check (adventurer_id = (select auth.uid()));

create policy own_read on public.adventures for select to authenticated
  using (adventurer_id = (select auth.uid()));
create policy own_read on public.adventure_contacts for select to authenticated
  using (exists (select 1 from public.adventures a where a.id = adventure_id and a.adventurer_id = (select auth.uid())));
create policy own_read on public.position_readings for select to authenticated
  using (exists (select 1 from public.adventures a where a.id = adventure_id and a.adventurer_id = (select auth.uid())));
create policy own_read on public.messages for select to authenticated
  using (exists (select 1 from public.adventures a where a.id = adventure_id and a.adventurer_id = (select auth.uid())));

-- Live Stage changes for the screens; Realtime applies the select policies above.
alter publication supabase_realtime add table public.adventures;

------------------------------------------------------------------------------------------
-- Guards
------------------------------------------------------------------------------------------

-- A contact that an Active, Overdue or Alerted Adventure uses cannot be removed.
-- A Planned Adventure does not block removal: the contact leaves that Adventure instead,
-- and Start refuses 'no_contacts' if none remain.
create function private.guard_contact_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.removed_at is not null and old.removed_at is null then
    if exists (
      select 1 from public.adventure_contacts ac
      join public.adventures a on a.id = ac.adventure_id
      where ac.contact_id = new.id and a.stage in ('active', 'overdue', 'alerted')
    ) then
      raise exception 'barry:contact_in_use' using errcode = 'P0001';
    end if;
    delete from public.adventure_contacts ac
     using public.adventures a
     where a.id = ac.adventure_id and ac.contact_id = new.id and a.stage = 'planned';
  end if;
  return new;
end $$;
create trigger guard_contact_removal before update of removed_at on public.emergency_contacts
  for each row execute function private.guard_contact_removal();

-- An account cannot be deleted while it has an Active, Overdue or Alerted Adventure.
-- Otherwise the delete cascades through every table. The app has no account delete in v1, so
-- this covers the Supabase dashboard and the Auth admin API.
create function private.guard_account_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.adventures
    where adventurer_id = old.id and stage in ('active', 'overdue', 'alerted')
  ) then
    raise exception 'barry:adventure_in_progress' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger guard_account_delete before delete on auth.users
  for each row execute function private.guard_account_delete();

------------------------------------------------------------------------------------------
-- The clock: one pure decision function + one effectful reconcile per Adventure.
------------------------------------------------------------------------------------------

-- PURE. Given an Adventure's clock state and `now`, what is owed right now?
-- Applies at most one Stage transition and one Alert round per call; reconcile() loops.
-- Unit-tested with pgTAP over a table of (state, now) -> decision cases.
create type private.clock_decision as (
  next_stage           public.adventure_stage,   -- null = no transition
  owe_reminder         boolean,
  owe_overdue_notice   boolean,
  alert_round          smallint                  -- null = no Alert round owed
);

create function private.decide(
  stage public.adventure_stage, deadline timestamptz, deadline_set_at timestamptz,
  alerts_sent smallint, last_alert_at timestamptz, now timestamptz
) returns private.clock_decision
language sql immutable as $$
  -- TODO pseudocode:
  -- case stage
  --   'active':
  --      if now >= deadline                         -> next_stage = 'overdue'
  --      elsif now >= deadline - reminder_lead()
  --        and deadline_set_at <= deadline - reminder_lead()   -- no Reminder for a Deadline set inside the lead time
  --                                                 -> owe_reminder
  --   'overdue':
  --      if now >= deadline + grace_period()        -> next_stage = 'alerted', alert_round = 1
  --      else                                       -> owe_overdue_notice   (idempotent; the first tick in Overdue sends it)
  --   'alerted':
  --      if alerts_sent < max_alerts() and now >= last_alert_at + alert_interval()
  --                                                 -> alert_round = alerts_sent + 1
  --   'planned' | 'ended': nothing
  -- Catch-up rule (tick was down): an Overdue Notice is NOT owed once now >= deadline + grace
  -- (it would announce an Alert time in the past); rounds are spaced from last_alert_at,
  -- never fired in a burst.
  select null::public.adventure_stage, false, false, null::smallint
$$;

-- EFFECTFUL. Locks one Adventure, applies decide() until it returns nothing, enqueues
-- messages, and enqueues missing Heads-ups for every contact of an in-progress Adventure.
-- Called by tick() for due Adventures and by command RPCs AFTER their own change (never
-- before), so exactly one code path decides what Barry sends.
create function private.reconcile(p_adventure_id uuid, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- TODO pseudocode:
  -- select * into a from public.adventures where id = p_adventure_id for update;
  -- loop
  --   d := private.decide(a.stage, a.deadline, a.deadline_set_at, a.alerts_sent, a.last_alert_at, p_now);
  --   exit when d is "nothing";
  --   if d.next_stage is not null then update stage; end if;
  --   if d.owe_reminder       then perform private.enqueue_push(a.id, 'reminder');       end if;
  --   if d.owe_overdue_notice then perform private.enqueue_push(a.id, 'overdue_notice'); end if;
  --   if d.alert_round is not null then
  --     update adventures set alerts_sent = d.alert_round, last_alert_at = p_now;
  --     perform private.enqueue_to_contacts(a.id, 'alert', d.alert_round);
  --   end if;
  --   reload a;
  -- end loop;
  -- if a.stage in ('active','overdue','alerted') then
  --   perform private.enqueue_to_contacts(a.id, 'heads_up', null);   -- the unique key keeps only new contacts
  -- end if;
  raise exception 'not implemented';
end $$;

-- Fan out one message to the current contacts of the Adventure: one row per channel the
-- contact has AND Barry has enabled. A contact with no enabled channel gets exactly ONE row,
-- born 'failed' with 'channel_not_enabled', so the Adventurer sees a Delivery Failure.
-- While sms is disabled, a contact with email and phone gets only the email row.
--   with reach as (
--     select c.id as contact_id, ch.channel, ch.address, cfg.enabled
--     from public.adventure_contacts ac
--     join public.emergency_contacts c on c.id = ac.contact_id
--     cross join lateral (values ('email'::public.channel, c.email), ('sms', c.phone)) ch(channel, address)
--     join private.channel_config cfg on cfg.channel = ch.channel
--     where ac.adventure_id = p_adventure_id and ch.address is not null)
--   insert into public.messages (adventure_id, kind, round, channel, to_address, contact_id, status, failure_reason)
--   select p_adventure_id, p_kind, p_round, r.channel, r.address, r.contact_id,
--          case when r.enabled then 'pending' else 'failed' end,
--          case when r.enabled then null else 'channel_not_enabled' end
--   from reach r
--   where r.enabled
--      or (not exists (select 1 from reach o where o.contact_id = r.contact_id and o.enabled)
--          and r.channel = (select min(o.channel) from reach o where o.contact_id = r.contact_id))
--   -- a contact removed and re-added gets its cancelled Heads-up back
--   on conflict on constraint messages_once do update
--     set status = 'pending', attempts = 0, next_attempt_at = now(), lease_until = null
--     where public.messages.status = 'cancelled' and public.messages.kind = 'heads_up';
create function private.enqueue_to_contacts(p_adventure_id uuid, p_kind public.message_kind, p_round smallint)
returns void language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- One row per push device of the Adventurer, keyed by the current Deadline, if push is enabled.
-- Zero devices = zero rows; the Start warnings told the Adventurer.
create function private.enqueue_push(p_adventure_id uuid, p_kind public.message_kind)
returns void language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- The All-clear audience: exactly the (channel, address) pairs whose Alert may have reached them
-- when the Check-in commits: 'sent', 'sending', or 'pending' with attempts > 0 (a retry whose
-- earlier attempt may have been delivered). Called by check_in after it cancelled the rest.
--   insert into public.messages (adventure_id, kind, channel, to_address, contact_id)
--   select distinct adventure_id, 'all_clear', channel, to_address, contact_id
--   from public.messages
--   where adventure_id = p_adventure_id and kind = 'alert'
--     and (status in ('sending', 'sent') or (status = 'pending' and attempts > 0))
--   on conflict on constraint messages_once do nothing;
-- Ordering after an in-flight Alert is enforced by claim_messages(), not here.
create function private.enqueue_all_clear(p_adventure_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- Wake the deliverer. pg_net queues the request in a table, so it is transactional:
-- a rolled-back command sends nothing. URL and bearer secret come from Vault.
create function private.kick_deliverer() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- perform net.http_post(
  --   url     := (select decrypted_secret from vault.decrypted_secrets where name = 'deliver_url'),
  --   headers := jsonb_build_object('Authorization', 'Bearer ' ||
  --                (select decrypted_secret from vault.decrypted_secrets where name = 'deliver_secret')),
  --   body    := '{}'::jsonb, timeout_milliseconds := 10000);
  raise exception 'not implemented';
end $$;

-- The Deadline check. Runs inside Postgres via pg_cron.
create function private.tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- TODO pseudocode:
  -- for r in
  --   select id from public.adventures
  --   where stage in ('active','overdue','alerted')
  --     and deadline <= now() + private.reminder_lead()
  --     and not (stage = 'alerted' and alerts_sent >= private.max_alerts())
  --   for update skip locked          -- a concurrent command holds the lock; it reconciles itself
  -- loop
  --   begin                           -- one bad Adventure must not stop the others
  --     perform private.reconcile(r.id);
  --   exception when others then
  --     insert into private.tick_error (adventure_id, sqlstate, message) values (r.id, sqlstate, sqlerrm);
  --   end;
  -- end loop;
  -- insert into private.clock_status values (true, now()) on conflict (id) do update set last_tick_at = now();
  -- perform private.kick_deliverer();  -- also the heartbeat trigger: deliver runs every tick
  raise exception 'not implemented';
end $$;

select cron.schedule('barry-tick', '* * * * *', $$select private.tick()$$);

------------------------------------------------------------------------------------------
-- deliver's interface: public functions that only service_role may execute. deliver calls
-- them with supabase.rpc() and the service role key. No direct Postgres connection.
------------------------------------------------------------------------------------------

-- Claim up to p_limit due messages with a lease. Crash-safe: an expired lease makes the row
-- claimable again (at-least-once).
create function public.claim_messages(p_limit int, p_lease interval default interval '2 minutes')
returns setof public.messages language plpgsql security definer set search_path = '' as $$
begin
  -- TODO pseudocode:
  -- 1. Cancel pending rows that must not go out any more. Only Heads-up, Reminder and
  --    Overdue Notice. NEVER an Alert (check_in owns Alert cancellation, and only for
  --    'pending' rows), and never a 'sending' row of any kind.
  --    update messages m set status = 'cancelled'
  --    from adventures a where a.id = m.adventure_id and m.status = 'pending' and (
  --      (m.kind = 'heads_up' and not exists (adventure_contacts where adventure_id, contact_id))  -- contact removed
  --      or (m.kind in ('reminder','overdue_notice') and m.for_deadline <> a.deadline)          -- Deadline moved
  --      or (m.kind in ('heads_up','reminder','overdue_notice') and a.stage = 'ended'));        -- retry after Check-in
  -- 2. Cancel an All-clear whose address has no Alert left in flight and none sent
  --    (every Alert to it failed): failure_reason = 'no_alert_delivered'.
  -- 3. Claim, with per-address ordering:
  --    with c as (
  --      select id from messages m
  --      where ((status = 'pending' and next_attempt_at <= now())
  --             or (status = 'sending' and lease_until < now()))
  --        and not exists (
  --          select 1 from messages e
  --          where e.adventure_id = m.adventure_id and e.channel = m.channel
  --            and e.to_address = m.to_address and e.id <> m.id
  --            and e.status in ('pending', 'sending')
  --            and (   (m.kind = 'all_clear' and e.kind = 'alert')                    -- All-clear waits for every Alert
  --                 or (m.kind = 'alert' and e.kind = 'alert' and e.round < m.round)))  -- round n waits for n-1
  --        -- Nothing else blocks: an Alert overtakes a Heads-up in retry backoff.
  --      order by id limit p_limit for update skip locked)
  --    update messages set status = 'sending', lease_until = now() + p_lease, attempts = attempts + 1
  --    from c where messages.id = c.id returning messages.*;
  raise exception 'not implemented';
end $$;

-- Record the outcome of one send. Idempotent per (id, attempt): a late report for an
-- attempt that already lost its lease is ignored.
create function public.settle_message(
  p_id bigint, p_attempt smallint, p_outcome text,      -- 'sent' | 'retry' | 'failed'
  p_provider_ref text default null, p_reason text default null, p_retry_after interval default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- TODO: 'retry' goes back to 'pending' with backoff (30s, 1m, 2m, 5m, 10m); after 6 attempts
  -- it becomes 'failed' with 'retries_exhausted'. 'failed' is final at once.
  raise exception 'not implemented';
end $$;

-- Health for the heartbeat: is the clock ticking, is every Adventure reconciling, and is the
-- outbox draining?
create function public.health()
returns table (clock_ok boolean, adventures_ok boolean, outbox_ok boolean, detail text)
language sql security definer set search_path = '' as $$
  -- clock_ok:      last_tick_at > now() - interval '2 minutes'
  -- adventures_ok: no private.tick_error row with at > now() - interval '2 minutes'
  -- outbox_ok:     no pending row with next_attempt_at < now() - interval '5 minutes'
  select false, false, false, 'not implemented'
$$;

-- Everything a template needs for one message, as one JSON document, read at SEND time so an
-- Alert always carries the latest Plan, the Last Known Position and the full Profile.
-- Shape (parsed by deliver into MessageFacts):
--   { kind, round, time_zone, adventurer_name, plan: {destination, route, starting_point, notes},
--     deadline, alert_at (Overdue Notice only),
--     profile: {phone, car_make, car_colour, car_plate, medical_notes} (Alert only),
--     last_known_position: {taken_at, latitude, longitude, accuracy_m} | null (Alert only),
--     checked_in_at (All-clear only), contact_name }
-- Only the Alert carries the full Adventurer Profile. Every other kind gets the name only.
create function public.message_facts(p_message_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$ select null::jsonb $$;

revoke execute on function public.claim_messages, public.settle_message, public.health,
  public.message_facts from public, anon, authenticated;
grant execute on function public.claim_messages, public.settle_message, public.health,
  public.message_facts to service_role;

------------------------------------------------------------------------------------------
-- Command RPCs: the ONLY way the app changes an Adventure.
-- Each takes the Adventure row lock, returns public.refusal (null = accepted), is idempotent,
-- and calls reconcile() after its own change, never before.
------------------------------------------------------------------------------------------

-- Create (p_id null) or update an Adventure's Plan, Deadline and contacts.
-- Every id in p_contact_ids must be an emergency_contacts row with adventurer_id = auth.uid()
-- and removed_at is null, else 'unknown_contact'.
-- Planned:          everything editable. Destination, Deadline and contacts may be missing.
-- Active, Overdue:  Plan and contacts. p_deadline is ignored (moves go through move_deadline).
--                   At least one contact must remain ('no_contacts'). An added contact gets a
--                   Heads-up through reconcile(). A removed contact's pending rows are
--                   cancelled by claim_messages().
-- Alerted, Ended:   'wrong_stage'.
create function public.save_adventure(
  p_id uuid, p_destination text, p_route text, p_starting_point text, p_notes text,
  p_deadline timestamptz, p_contact_ids uuid[]
) returns table (adventure_id uuid, refusal public.refusal)
language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- Planned only. Hard delete; nothing ever referenced it.
create function public.delete_adventure(p_id uuid) returns public.refusal
language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- Planned -> Active. Idempotent: an already-in-progress Adventure with this id returns null
-- (the client retries after an ambiguous network failure and gets "protected").
-- Checks, in order: Profile row exists ('profile_incomplete'), destination not blank
-- ('destination_missing'), Deadline set ('deadline_missing') and > now()
-- ('deadline_not_in_future'), at least one contact ('no_contacts'; every contact has a phone
-- number or an email by table check), time zone in pg_timezone_names ('invalid_time_zone'),
-- unique-index violation -> 'another_adventure_in_progress'.
-- Then: stage = 'active', started_at = now(), deadline_set_at = now(), time_zone; insert the
-- position reading if given; reconcile() (Heads-ups); kick_deliverer().
create function public.start_adventure(
  p_id uuid, p_time_zone text,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- Active or Overdue only; the new Deadline must be > the old one and > now(). Overdue -> Active.
-- Records deadline_set_at = now() and a position reading. Idempotent: the same Deadline again
-- is a no-op. Waits on the row lock if tick() holds it; if the tick Alerted the Adventure,
-- returns 'wrong_stage'. No reconcile before the move: during the tick lag the Alert has not
-- gone out, and the spec allows a move any time before the Alert.
create function public.move_deadline(
  p_id uuid, p_deadline timestamptz,
  p_latitude double precision default null, p_longitude double precision default null,
  p_accuracy_m real default null, p_position_taken_at timestamptz default null
) returns public.refusal
language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

-- Active, Overdue or Alerted -> Ended. Idempotent: Ended returns null, so the offline queue can
-- resend freely. Planned returns 'wrong_stage'.
--   update adventures set stage = 'ended', ended_at = now(),
--     checked_in_at = least(now(), greatest(coalesce(p_checked_in_at, now()), started_at));
--   update messages set status = 'cancelled' where adventure_id = p_id and status = 'pending'
--     and not (kind = 'alert' and attempts > 0);
--     -- An attempted Alert may already have been delivered, so it keeps retrying and its
--     -- address gets an All-clear.
--     -- READ COMMITTED: if deliver holds the claim lock on an Alert row, this waits, rereads
--     -- the row, sees 'sending' and leaves it. A 'sending' Alert is never cancelled.
--   if the Adventure was Alerted: perform private.enqueue_all_clear(p_id);  -- a later statement,
--     -- so it sees that Alert as 'sending' and includes its address
--   perform private.kick_deliverer();
-- No reconcile: an Ended Adventure owes nothing.
create function public.check_in(p_id uuid, p_checked_in_at timestamptz) returns public.refusal
language plpgsql security definer set search_path = '' as $$
begin raise exception 'not implemented'; end $$;

------------------------------------------------------------------------------------------
-- Read-only queries for the screens.
------------------------------------------------------------------------------------------

-- The channels Barry sends on. The contact screen marks a phone number "Text messages not set
-- up yet" when sms is missing, and the Start warnings list the contacts that get email only.
--   select channel from private.channel_config where enabled;
create function public.enabled_channels() returns setof public.channel
language sql stable security definer set search_path = '' as $$
  select null::public.channel where false
$$;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public;
grant execute on function public.save_adventure, public.delete_adventure, public.start_adventure,
  public.move_deadline, public.check_in, public.enabled_channels to authenticated;

-- Vault secrets set out of band (supabase/seed.sql locally, dashboard in production):
--   deliver_url, deliver_secret
-- Edge Function secrets: DELIVER_SECRET, HEALTHCHECK_URL, EMAIL_*, later a text message provider's.
-- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to every Edge Function.
