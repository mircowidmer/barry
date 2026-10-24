#!/usr/bin/env node
// Preconditions and time travel for verification runs, against the local database only.
// It never stands in for a user action: the app drives every step the user takes.
//   fixture.mjs state                 the test account's live Adventure, its contacts and messages
//   fixture.mjs live [minutes]        create a live Adventure for the test account (Deadline in N min, default 120)
//   fixture.mjs overdue               move the live Adventure's Deadline to now
//   fixture.mjs trail                 the latest Adventure's readings by reason, and each contact's Trail Map token
//   fixture.mjs end                   check in from any live Adventure of the test account (cleanup)
//   fixture.mjs offline | online      stop or start the API gateway, so the app has "no signal"
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const email = readFileSync(join(root, '.env.local'), 'utf8').match(/^BARRY_TEST_EMAIL=(.*)$/m)?.[1];
if (!email) throw new Error('BARRY_TEST_EMAIL is missing from .env.local');

const sql = (query) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_barry-local', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA', '-F', ' | '], {
    input: query,
    encoding: 'utf8',
  }).trim();

const anna = `(select id from auth.users where email = '${email.replace(/'/g, "''")}')`;
const live = `(select id from public.adventures where adventurer_id = ${anna} and stage in ('active', 'overdue', 'alerted'))`;

const commands = {
  state: () =>
    sql(`
      select 'adventure', stage, destination, to_char(deadline at time zone 'Europe/Zurich', 'HH24:MI'),
             to_char(alert_at at time zone 'Europe/Zurich', 'HH24:MI'), alerts_sent from public.adventures where id = ${live};
      select 'contact', c.name, coalesce(c.email, '-'), coalesce(c.phone, '-') from public.adventure_contacts ac
        join public.emergency_contacts c on c.id = ac.contact_id where ac.adventure_id = ${live} order by c.name;
      select 'message', kind, channel, to_address, status, coalesce(failure_reason, '') from public.messages
        where adventure_id = ${live} order by id;`) || 'no live Adventure',
  live: (minutes = '120') => {
    if (!/^\d+$/.test(minutes)) throw new Error('minutes must be a whole number');
    return sql(`
      with adv as (
        insert into public.adventures (adventurer_id, stage, destination, deadline, deadline_set_at, time_zone, started_at)
        select ${anna}, 'active', 'Pilatus', now() + interval '${minutes} minutes', now() - interval '2 hours',
               'Europe/Zurich', now() - interval '2 hours'
        returning id, adventurer_id)
      insert into public.adventure_contacts (adventure_id, contact_id)
      select adv.id, c.id from adv join public.emergency_contacts c
        on c.adventurer_id = adv.adventurer_id and c.name = 'Luca' and c.removed_at is null
      returning adventure_id;`);
  },
  overdue: () => sql(`update public.adventures set deadline = now() where id = ${live} returning stage;`),
  trail: () => {
    const latest = `(select id from public.adventures where adventurer_id = ${anna} order by created_at desc limit 1)`;
    return sql(`
      select 'adventure', stage from public.adventures where id = ${latest};
      select 'readings', reason, count(*), count(distinct slot),
             to_char(min(taken_at) at time zone 'Europe/Zurich', 'HH24:MI:SS'),
             to_char(max(taken_at) at time zone 'Europe/Zurich', 'HH24:MI:SS')
        from public.position_readings where adventure_id = ${latest} group by reason order by reason;
      select 'link', c.name, ac.trail_token from public.adventure_contacts ac
        join public.emergency_contacts c on c.id = ac.contact_id where ac.adventure_id = ${latest} order by c.name;`);
  },
  end: () => {
    // Resolved first: once the role is authenticated, auth.users is not readable.
    const id = sql(`select id from auth.users where email = '${email.replace(/'/g, "''")}';`);
    const adventure = sql(`select id from public.adventures where adventurer_id = '${id}' and stage in ('active', 'overdue', 'alerted');`);
    if (!adventure) return 'nothing to end';
    sql(`
      begin;
      select set_config('request.jwt.claims', json_build_object('sub', '${id}', 'role', 'authenticated')::text, true);
      set local role authenticated;
      select public.check_in('${adventure}', now());
      commit;`);
    return `checked in from ${adventure}`;
  },
  offline: () => execFileSync('docker', ['stop', 'supabase_kong_barry-local'], { encoding: 'utf8' }).trim() + ' stopped',
  online: () => execFileSync('docker', ['start', 'supabase_kong_barry-local'], { encoding: 'utf8' }).trim() + ' started',
};

const [name, ...args] = process.argv.slice(2);
if (!commands[name]) {
  console.error('usage: fixture.mjs state | live [minutes] | overdue | trail | end | offline | online');
  process.exit(2);
}
console.log(commands[name](...args));
