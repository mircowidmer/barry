-- A Deadline more than a year ahead protects nobody and only leaves rows the clock carries for ever, such as a
-- Planned Adventure due in the year 9999. A trigger rather than a refusal in save_adventure and move_deadline,
-- like the length limits: no honest Plan needs such a Deadline, and the commands stay as they are. Like those,
-- it checks a Deadline only when it is new or changed, so rows saved before the bound stay as they are.

create function private.max_deadline_ahead() returns interval language sql immutable set search_path = '' as $$
  select interval '1 year'
$$;
revoke execute on function private.max_deadline_ahead from public;

create function private.guard_deadline_bound() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.deadline is distinct from old.deadline)
     and new.deadline > now() + private.max_deadline_ahead() then
    raise exception 'barry:deadline_too_far';
  end if;
  return new;
end $$;
revoke execute on function private.guard_deadline_bound from public;

create trigger guard_deadline_bound before insert or update of deadline on public.adventures
  for each row execute function private.guard_deadline_bound();
