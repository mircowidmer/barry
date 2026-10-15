create extension if not exists pg_cron;

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

create function private.tick(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  -- A command holding an Adventure's lock reconciles it itself, so the tick skips it.
  for r in
    select id from public.adventures
    where stage in ('active', 'overdue', 'alerted')
      and deadline <= p_now + private.reminder_lead()
      and not (stage = 'alerted' and alerts_sent >= private.max_alerts())
    for update skip locked
  loop
    begin
      perform private.reconcile(r.id, p_now);
    exception when others then
      insert into private.tick_error (at, adventure_id, sqlstate, message)
      values (p_now, r.id, sqlstate, sqlerrm);
    end;
  end loop;

  insert into private.clock_status (id, last_tick_at) values (true, p_now)
  on conflict (id) do update set last_tick_at = excluded.last_tick_at;
end $$;

revoke execute on function private.tick from public;

select cron.schedule('barry-tick', '* * * * *', 'select private.tick()');
