import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md:182 "After the Check-in, the page shows the time of the Check-in, the Trail up to the Check-in and the Last Known
// Position. Barry records no readings after the Check-in."
test('the Trail stops at the Check-in, and the Trail Map shows the Check-in time', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  const reading = (seconds, latitude) => ({ taken_at: new Date(Date.now() + seconds * 1000).toISOString(), latitude, longitude: 8.69, accuracy_m: 8 });
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [reading(1, 47.04)] }), 'record_trail'), null);
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [reading(2, 47.05)] }), 'record_trail'), 'wrong_stage', 'a reading after the Check-in is refused');

  const map = await trailMap(token);
  const { checked_in_at } = must(await anna.client.from('adventures').select('checked_in_at').eq('id', id).single(), 'adventure');
  assert.equal(map.status, 'checked_in');
  assert.equal(new Date(map.checked_in_at).getTime(), new Date(checked_in_at).getTime(), 'the Trail Map shows the time of the Check-in');
  assert.deepEqual(map.trail.map(([latitude]) => latitude), [47.03, 47.04], 'the Trail holds the Start and the reading before the Check-in, and nothing after');
  assert.equal(map.last_known_position.latitude, 47.04, 'the Last Known Position is the last reading before the Check-in');
});
