import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { after } from 'node:test';
import { createClient } from '@supabase/supabase-js';

export const API = 'http://127.0.0.1:54321';
const MAILPIT = 'http://127.0.0.1:54324/api/v1';

const keys = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.match(/^(\w+)="(.*)"$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);
const options = { auth: { persistSession: false } };
export const admin = createClient(API, keys.SECRET_KEY, options);

export const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

export const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

// The clock ticks once a minute, so anything it does shows up within about two minutes.
const poll = async (what, find, seconds = 150) => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const found = await find();
    if (found) return found;
    await sleep(2);
  }
  throw new Error(`no ${what} within ${seconds} seconds`);
};

const mails = async (to, subject) => {
  const query = encodeURIComponent(`to:${to} subject:"${subject}"`);
  return (await fetch(`${MAILPIT}/search?query=${query}`).then((r) => r.json())).messages;
};

export const waitForMail = (to, subject) =>
  poll(`email "${subject}" to ${to}`, async () => {
    const [first] = await mails(to, subject);
    return first && fetch(`${MAILPIT}/message/${first.ID}`).then((r) => r.json());
  });

export const mailCount = async (to, subject) => (await mails(to, subject)).length;

export const trailMap = async (token, after) => {
  const response = await fetch(`${API}/rest/v1/rpc/trail_map`, {
    method: 'POST',
    headers: { apikey: keys.PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(after ? { p_token: token, p_after: after } : { p_token: token }),
  });
  assert.ok(response.ok, `trail_map answered ${response.status}`);
  return response.json();
};

export const trailToken = (text) => text.match(/Follow Anna's Trail: \S+#([\w-]{22})/)?.[1];

export const messageKinds = async (adventureId) =>
  must(await admin.from('messages').select('kind, to_address, status').eq('adventure_id', adventureId), 'messages');

/** A signed-in Adventurer with a Profile and two contacts, deleted again when the file's tests end. */
export const adventurer = async () => {
  const run = randomUUID().slice(0, 8);
  const email = `anna-${run}@example.com`;
  const password = randomUUID();
  const { user } = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create user');
  const client = createClient(API, keys.PUBLISHABLE_KEY, options);
  must(await client.auth.signInWithPassword({ email, password }), 'sign in');

  after(async () => {
    const { data: live } = await admin.from('adventures').select('id').eq('adventurer_id', user.id).neq('stage', 'ended');
    for (const { id } of live ?? []) await client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() });
    await admin.auth.admin.deleteUser(user.id);
  });

  must(
    await client.from('adventurer_profiles').insert({
      id: user.id, name: 'Anna', phone: '+41790000001', car_make: 'Subaru', car_colour: 'red', car_plate: 'SZ 12345',
    }),
    'profile',
  );
  const contact = async (fields) => ({
    ...fields,
    ...must(await client.from('emergency_contacts').insert(fields).select('id').single(), 'contact'),
  });
  const luca = await contact({ name: 'Luca', email: `luca-${run}@example.com` });
  const sara = await contact({ name: 'Sara', phone: `+4179${String(randomInt(1e7)).padStart(7, '0')}` });

  const start = async (contacts = [luca, sara], plan = {}) => {
    const [saved] = must(
      await client.rpc('save_adventure', {
        p_id: null, p_destination: 'Grosser Mythen', p_route: 'East ridge', p_starting_point: 'Brunni car park',
        p_notes: null, p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
        p_contact_ids: contacts.map((c) => c.id), ...plan,
      }),
      'save_adventure',
    );
    const refusal = must(
      await client.rpc('start_adventure', {
        p_id: saved.adventure_id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12,
      }),
      'start_adventure',
    );
    assert.equal(refusal, null, 'start_adventure accepts the Adventure');
    return saved.adventure_id;
  };

  return { client, userId: user.id, luca, sara, contact, start };
};

/** Fails unless the clock ticked in the last two minutes, so a test that expects silence cannot pass on a stopped clock. */
export const assertClockRan = async () => {
  const [health] = must(await admin.rpc('health'), 'health');
  assert.equal(health.clock_ok, true, 'the clock ticked while the test waited');
};

/** Moves the Deadline into the past, as if the Adventurer had not come back in time. */
export const missDeadline = async (adventureId, minutesAgo = 2) =>
  must(
    await admin.from('adventures').update({ deadline: new Date(Date.now() - minutesAgo * 60_000).toISOString() }).eq('id', adventureId),
    'move the Deadline into the past',
  );
