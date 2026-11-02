import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/trail.md "keeps the Trail for the Adventurer after the Check-in"
// docs/spec.md § Location "The Trail stays with the Adventure after the Check-in. The app shows the map … on the Check-in screen and
// each Ended Adventure in the History tab."
test('the Adventurer keeps her Trail after the Check-in, and nobody else can read it', async () => {
  const anna = await adventurer();
  const marco = await adventurer();
  const id = await anna.start();

  const reading = { taken_at: new Date(Date.now() + 1000).toISOString(), latitude: 47.04, longitude: 8.69, accuracy_m: 8 };
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [reading] }), 'record_trail'), null);
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);

  // The query the app's readings runs for the map of the Trail.
  const readings = async (client) =>
    must(await client.from('position_readings').select('taken_at, latitude, longitude, accuracy_m').eq('adventure_id', id).order('taken_at'), 'readings');
  const kept = await readings(anna.client);
  assert.deepEqual(kept.map((r) => [r.latitude, r.longitude]), [[47.03, 8.68], [47.04, 8.69]], 'Anna reads the Start position and the Trail reading after the Check-in');
  assert.deepEqual(await readings(marco.client), [], 'Marco reads none of them');
});
