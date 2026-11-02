import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

const YEAR = 365 * 24 * 3600_000;
const yearBack = (at) => new Date(new Date(at).getTime() - YEAR).toISOString();

// docs/spec.md § Trail Map "The link never expires. After the Check-in it keeps showing the Check-in time and the Trail until the Adventurer deletes the Adventure or the account."
test('the Trail Map link never expires: a year after the Check-in it still shows the Check-in time and the Trail', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  assert.equal(
    must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [{ taken_at: new Date().toISOString(), latitude: 47.04, longitude: 8.69, accuracy_m: 8 }] }), 'record_trail'),
    null,
  );
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);

  // As if the Check-in had been a year ago: its times and the readings move back, and so does the Start,
  // which the Check-in time may not precede.
  const before = must(await admin.from('adventures').select('started_at, checked_in_at, ended_at').eq('id', id).single(), 'adventure');
  must(
    await admin.from('adventures').update(Object.fromEntries(Object.entries(before).map(([key, at]) => [key, yearBack(at)]))).eq('id', id),
    'move the Adventure a year back',
  );
  for (const reading of must(await admin.from('position_readings').select('id, taken_at').eq('adventure_id', id), 'readings')) {
    must(await admin.from('position_readings').update({ taken_at: yearBack(reading.taken_at) }).eq('id', reading.id), 'move a reading a year back');
  }

  const map = await trailMap(token);
  assert.equal(map?.status, 'checked_in', 'the link still works a year after the Check-in');
  assert.equal(new Date(map.checked_in_at).getTime(), new Date(yearBack(before.checked_in_at)).getTime(), 'it shows the time of the Check-in');
  assert.deepEqual(map.trail.map(([latitude, longitude]) => [latitude, longitude]), [[47.03, 8.68], [47.04, 8.69]], 'it shows the Trail from the Start reading on');
  assert.ok(map.trail.every(([, , takenAt]) => Date.now() - new Date(takenAt).getTime() > YEAR - 3600_000), 'every reading is a year old');
  assert.equal(map.last_known_position.latitude, 47.04, 'it shows the Last Position');
});
