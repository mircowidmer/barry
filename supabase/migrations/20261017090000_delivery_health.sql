-- health() also reports when messages stop arriving at the providers: an Alert that failed, or
-- an email or text message channel where several messages failed in a row and none went out.

alter table public.messages add column settled_at timestamptz;

create function private.stamp_settled() returns trigger language plpgsql as $$
begin
  if new.status in ('sent', 'failed') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.settled_at := now();
  end if;
  return new;
end $$;

create trigger stamp_settled before insert or update of status on public.messages
  for each row execute function private.stamp_settled();

drop function public.health();
create function public.health()
returns table (clock_ok boolean, adventures_ok boolean, outbox_ok boolean, delivery_ok boolean)
language sql stable security definer set search_path = '' as $$
  select
    coalesce((select last_tick_at > now() - interval '2 minutes' from private.clock_status), false),
    not exists (select 1 from private.tick_error where at > now() - interval '2 minutes'),
    not exists (
      select 1 from public.messages
      where (status = 'pending' and next_attempt_at < now() - interval '5 minutes')
         or (status = 'sending' and lease_until < now() - interval '5 minutes')),
    -- A switched-off channel is the Adventurer's warning, not a provider failure.
    not exists (
      select 1 from public.messages
      where kind = 'alert' and status = 'failed' and failure_reason is distinct from 'channel_not_enabled'
        and settled_at > now() - interval '15 minutes')
    and not exists (
      select 1 from public.messages
      where channel in ('email', 'sms') and settled_at > now() - interval '15 minutes'
        and failure_reason is distinct from 'channel_not_enabled'
      group by channel
      having count(*) filter (where status = 'failed') >= 3 and count(*) filter (where status = 'sent') = 0)
$$;

revoke execute on function public.health from public, anon, authenticated;
grant execute on function public.health to service_role;
