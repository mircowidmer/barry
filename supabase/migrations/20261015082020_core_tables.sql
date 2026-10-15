revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public;

-- Fail closed: a table or function added later without an explicit grant is invisible to the app.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

create type public.message_kind as enum ('heads_up', 'reminder', 'overdue_notice', 'alert', 'all_clear');
create type public.channel as enum ('email', 'sms', 'push');
create type public.message_status as enum ('pending', 'sending', 'sent', 'failed', 'cancelled');

create table public.adventurer_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null check (length(btrim(name)) > 0),
  phone          text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
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

create table private.channel_config (
  channel  public.channel primary key,
  enabled  boolean not null
);
insert into private.channel_config values ('email', true), ('sms', false), ('push', true);

-- Declared immutable so a stored generated column can use it. It only adds a fixed number of
-- minutes, which gives the same result in every time zone.
create function private.alert_time(deadline timestamptz) returns timestamptz
language sql immutable as $$ select deadline + private.grace_period() $$;

create table public.adventures (
  id               uuid primary key default gen_random_uuid(),
  adventurer_id    uuid not null references auth.users (id) on delete cascade,
  stage            public.adventure_stage not null default 'planned',

  destination      text,
  route            text,
  starting_point   text,
  notes            text,

  deadline         timestamptz,
  alert_at         timestamptz generated always as (private.alert_time(deadline)) stored,
  deadline_set_at  timestamptz,
  time_zone        text,

  started_at       timestamptz,
  alerts_sent      smallint not null default 0 check (alerts_sent between 0 and 3),
  last_alert_at    timestamptz,
  checked_in_at    timestamptz,
  ended_at         timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  check ((stage = 'planned') = (started_at is null)),
  check (stage = 'planned' or (deadline is not null and deadline_set_at is not null
                               and time_zone is not null and destination is not null)),
  check ((stage = 'ended') = (ended_at is not null and checked_in_at is not null)),
  check (checked_in_at is null or checked_in_at between started_at and ended_at),
  check ((alerts_sent > 0) = (last_alert_at is not null)),
  check (stage <> 'alerted' or alerts_sent >= 1),
  check (stage in ('alerted', 'ended') or alerts_sent = 0)
);

create unique index adventures_one_in_progress
  on public.adventures (adventurer_id)
  where stage in ('active', 'overdue', 'alerted');

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

create table public.messages (
  id               bigint generated always as identity primary key,
  adventure_id     uuid not null references public.adventures (id) on delete cascade,
  kind             public.message_kind not null,
  channel          public.channel not null,
  to_address       text not null,
  contact_id       uuid references public.emergency_contacts (id),
  round            smallint,
  for_deadline     timestamptz,

  status           public.message_status not null default 'pending',
  attempts         smallint not null default 0,
  next_attempt_at  timestamptz not null default now(),
  lease_until      timestamptz,
  sent_at          timestamptz,
  provider_ref     text,
  failure_reason   text,
  created_at       timestamptz not null default now(),

  check ((kind = 'alert') = (round is not null)),
  check (round is null or round between 1 and 3),
  check ((kind in ('reminder', 'overdue_notice')) = (for_deadline is not null)),
  check ((kind in ('reminder', 'overdue_notice')) = (channel = 'push')),
  check ((channel = 'push') = (contact_id is null)),

  -- Every enqueue is an insert ... on conflict, so running any path twice sends nothing twice.
  -- for_deadline in the key re-arms the Reminder and the Overdue Notice when the Deadline moves.
  constraint messages_once unique nulls not distinct
    (adventure_id, kind, round, for_deadline, channel, to_address)
);

create index messages_due on public.messages (next_attempt_at) where status in ('pending', 'sending');
create index on public.messages (adventure_id, channel, to_address, kind) where status in ('pending', 'sending');

create view public.delivery_failures with (security_invoker = true) as
  select m.id, m.adventure_id, m.kind, m.channel, m.to_address, m.contact_id,
         c.name as contact_name, m.round, m.failure_reason, m.created_at
  from public.messages m
  left join public.emergency_contacts c on c.id = m.contact_id
  where m.status = 'failed' and m.kind in ('heads_up', 'alert', 'all_clear');

alter table public.adventurer_profiles enable row level security;
alter table public.emergency_contacts  enable row level security;
alter table public.push_devices        enable row level security;
alter table public.adventures          enable row level security;
alter table public.adventure_contacts  enable row level security;
alter table public.position_readings   enable row level security;
alter table public.messages            enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update on public.adventurer_profiles to authenticated;
grant select, insert on public.emergency_contacts to authenticated;
grant update (name, phone, email, removed_at) on public.emergency_contacts to authenticated;
grant select, insert, update, delete on public.push_devices to authenticated;
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

alter publication supabase_realtime add table public.adventures;

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
