create function public.enabled_channels() returns setof public.channel
language sql stable security definer set search_path = '' as $$
  select channel from private.channel_config where enabled order by channel
$$;

revoke execute on function public.enabled_channels from public, anon;
grant execute on function public.enabled_channels to authenticated;
