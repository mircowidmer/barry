import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomInt, randomUUID } from 'node:crypto';
import { after } from 'node:test';
import { createClient } from '@supabase/supabase-js';

export const API = 'http://127.0.0.1:54321';
const MAILPIT = 'http://127.0.0.1:54324/api/v1';
const SMS_RELAY = 'http://localhost:8788/messages';
const HEARTBEATS = 'http://localhost:8788/healthchecks';
const DELIVER_SECRET = readFileSync('supabase/config.toml', 'utf8').match(/^DELIVER_SECRET = "(.+)"$/m)[1];

const keys = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.match(/^(\w+)="(.*)"$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
);
await fetch(SMS_RELAY).catch(() => {
  throw new Error('The text message relay is not running. Start it with: node scripts/sms-relay.mjs');
});

const options = { auth: { persistSession: false } };
export const admin = createClient(API, keys.SECRET_KEY, options);

export const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

export const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

// The clock ticks once a minute, so anything it does shows up within about two minutes.
const POLL_SECONDS = 150;

const poll = async (what, find) => {
  const deadline = Date.now() + POLL_SECONDS * 1000;
  while (Date.now() < deadline) {
    const found = await find();
    if (found) return found;
    await sleep(2);
  }
  throw new Error(`no ${what} within ${POLL_SECONDS} seconds`);
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

export const textsTo = async (to) => (await fetch(SMS_RELAY).then((r) => r.json())).filter((m) => m.to === to);

export const waitForText = (to, start) =>
  poll(`text message starting "${start}" to ${to}`, async () => (await textsTo(to)).find((m) => m.body.startsWith(start)));

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

export const trailToken = (text) => text.match(/\/adventure#([\w-]{22})/)?.[1];

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

  const start = async () => {
    const [saved] = must(
      await client.rpc('save_adventure', {
        p_id: null, p_destination: 'Grosser Mythen', p_route: 'East ridge',
        p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
        p_contact_ids: [luca.id, sara.id],
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

/** Runs deliver the way the clock does, and returns the health it reported. */
export const runDeliver = async () => {
  const response = await fetch(`${API}/functions/v1/deliver`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DELIVER_SECRET}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.ok(response.ok, `deliver answered ${response.status}`);
  return (await response.json()).health;
};

/** The heartbeats the text message relay received in place of Healthchecks.io, oldest first. */
export const heartbeatsSince = async (since) =>
  (await fetch(HEARTBEATS).then((r) => r.json())).filter((h) => new Date(h.at) >= since);

/** Moves the last Alert an hour into the past and runs the clock once, as if an hour had passed without a Check-in. */
export const hourAfterAlert = async (adventureId) => {
  must(
    await admin.from('adventures').update({ last_alert_at: new Date(Date.now() - 61 * 60_000).toISOString() }).eq('id', adventureId),
    'move the last Alert into the past',
  );
  execFileSync('npx', ['supabase', 'db', 'query', '--local', 'select private.tick()'], { stdio: 'ignore' });
};

/** Runs the clock once now, as its next minute would, so an Adventure past its Deadline turns Overdue before the Grace Period ends. */
export const tick = () => execFileSync('npx', ['supabase', 'db', 'query', '--local', 'select private.tick()'], { stdio: 'ignore' });
