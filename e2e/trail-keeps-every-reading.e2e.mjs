import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

test('Supabase keeps every Trail reading it gets and drops only a second one in the same slot window', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  // docs/spec.md § Trail: Supabase does not thin the Trail out, and drops only a second reading in the same
  // `slot` window, which is seconds long, not minutes.
  const window = Math.floor(Date.now() / 10_000) * 10_000 + 10_000;
  const reading = (offsetMs, latitude) => ({
    taken_at: new Date(window + offsetMs).toISOString(), latitude, longitude: 8.69, accuracy_m: 8,
  });
  const readings = [reading(1_000, 47.01), reading(6_000, 47.02), reading(11_000, 47.03), reading(31_000, 47.04)];
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: readings }), 'record_trail'), null);

  const latitudes = (await trailMap(token)).trail.map(([latitude]) => latitude);
  assert.deepEqual(latitudes.slice(1), [47.01, 47.03, 47.04], 'the readings in different windows are all kept, the second one in a window is dropped');
});
