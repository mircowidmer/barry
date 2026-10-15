// End-to-end check of the clock and deliver against the local Supabase stack.
// Run: node scripts/e2e-deliver.mjs (with `npx supabase start` running).
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API = 'http://127.0.0.1:54321';
const MAILPIT = 'http://127.0.0.1:54324/api/v1';
const PUBLISHABLE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const SECRET_KEY = '<local secret key from npx supabase status>';

const admin = createClient(API, SECRET_KEY, { auth: { persistSession: false } });
const user = createClient(API, PUBLISHABLE_KEY, { auth: { persistSession: false } });

const run = randomUUID().slice(0, 8);
const email = `anna-${run}@example.com`;
const luca = `luca-${run}@example.com`;
const password = randomUUID();

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

const waitForMail = async (to, subject) => {
  for (let i = 0; i < 45; i++) {
    const query = encodeURIComponent(`to:${to} subject:"${subject}"`);
    const found = await fetch(`${MAILPIT}/search?query=${query}`).then((r) => r.json());
    if (found.messages_count > 0) {
      const message = await fetch(`${MAILPIT}/message/${found.messages[0].ID}`).then((r) => r.json());
      return message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`no email "${subject}" to ${to} within 90 seconds`);
};

const step = (text) => console.log(`- ${text}`);

const expect = (ok, what) => {
  if (!ok) throw new Error(`expected ${what}`);
  step(what);
};

const trailMap = async (token) => {
  const response = await fetch(`${API}/rest/v1/rpc/trail_map`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!response.ok) throw new Error(`trail_map: ${response.status} ${await response.text()}`);
  return response.json();
};

const trailLink = (message) => message.Text.match(/Follow Anna's Trail: (\S+)/)?.[1];

const { user: created } = must(
  await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  'create user',
);
must(await user.auth.signInWithPassword({ email, password }), 'sign in');
must(await user.from('adventurer_profiles').insert({ id: created.id, name: 'Anna', phone: '+41790000001', car_make: 'Subaru', car_colour: 'red', car_plate: 'SZ 12345' }), 'profile');
const contacts = must(
  await user.from('emergency_contacts').insert([
    { name: 'Luca', email: luca },
    { name: 'Sara', phone: '+41792222222' },
  ]).select('id'),
  'contacts',
);

const [saved] = must(
  await user.rpc('save_adventure', {
    p_id: null, p_destination: 'Grosser Mythen', p_route: 'East ridge', p_starting_point: 'Brunni car park',
    p_notes: null, p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
    p_contact_ids: contacts.map((c) => c.id),
  }),
  'save_adventure',
);
const id = saved.adventure_id;
const refusal = must(await user.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start');
step(`start_adventure refusal: ${refusal ?? 'none'}`);

let t = Date.now();
const headsUp = await waitForMail(luca, 'Anna is heading out to Grosser Mythen');
step(`Heads-up reached Luca in ${Math.round((Date.now() - t) / 1000)} s: "${headsUp.Subject}"`);

const link = trailLink(headsUp);
expect(/^http:\/\/[^/]+:8081\/trail#/.test(link ?? ''), `the Heads-up carries Luca's Trail Map link (${link})`);
const token = new URL(link).hash.slice(1);
let map = await trailMap(token);
expect(map?.status === 'underway', 'the Trail Map shows the Adventure underway without an account');
expect(!('deadline' in map) && map.trail.length === 1, 'the Trail Map shows the Start reading and no Deadline');

must(await admin.from('adventures').update({ deadline: new Date(Date.now() - 2 * 60_000).toISOString() }).eq('id', id), 'move Deadline into the past');
t = Date.now();
const alert = await waitForMail(luca, 'Anna has not checked in');
step(`Alert reached Luca in ${Math.round((Date.now() - t) / 1000)} s after the Grace Period ended:`);
console.log(alert.Text.split('\n').map((line) => `    ${line}`).join('\n'));
expect(trailLink(alert) === link, 'the Alert carries the same Trail Map link');
map = await trailMap(token);
expect(map?.status === 'alerted', 'the Trail Map shows the Alert');

const checkIn = must(await user.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
step(`check_in refusal: ${checkIn ?? 'none'}`);
t = Date.now();
const allClear = await waitForMail(luca, 'Anna is back safe');
step(`All-clear reached Luca in ${Math.round((Date.now() - t) / 1000)} s: "${allClear.Text}"`);
map = await trailMap(token);
expect(
  map?.status === 'checked_in' && typeof map.checked_in_at === 'string' && !('trail' in map) && !('last_known_position' in map),
  'the Trail Map shows the Check-in time and no positions',
);

const failures = must(await user.from('delivery_failures').select('contact_name, kind, failure_reason').eq('adventure_id', id), 'failures');
step(`Delivery Failures shown to Anna: ${failures.map((f) => `${f.contact_name} ${f.kind} (${f.failure_reason})`).join(', ')}`);

const [health] = must(await admin.rpc('health'), 'health');
step(`health: ${JSON.stringify(health)}`);

must(await admin.auth.admin.deleteUser(created.id), 'delete test user');
step('test user deleted');
