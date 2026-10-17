-- Twilio reports later whether a text message reached the phone. A delivered one gets its time,
-- and an undelivered one becomes a failed message, so the app shows it as a Delivery Failure.

alter table public.messages add column delivered_at timestamptz;

create function public.report_delivery(p_id bigint, p_provider_ref text, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('delivered', 'undelivered', 'failed') then
    raise exception 'unknown delivery status %', p_status;
  end if;

  -- A report can overtake settle_message, so a row still sending without a provider reference counts too.
  update public.messages
     set delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
         status = case when p_status = 'delivered' then status else 'failed' end::public.message_status,
         failure_reason = case when p_status = 'delivered' then failure_reason else p_reason end,
         lease_until = case when p_status = 'delivered' then lease_until else null end
   where id = p_id and channel = 'sms' and status in ('sending', 'sent')
     and (provider_ref is null or provider_ref = p_provider_ref);
end $$;

revoke execute on function public.report_delivery from public, anon, authenticated;
grant execute on function public.report_delivery to service_role;
