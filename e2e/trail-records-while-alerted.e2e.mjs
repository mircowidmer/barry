import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md:183 "The Trail keeps about one reading every 5 minutes, as accurate as the phone allows, from Start until the
// Check-in. It runs while the Adventure is Active, Overdue, and Alerted."
test('the Trail records while the Adventure is Alerted, and the Trail Map shows the new Last Position with the Alert', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');

  const reading = { taken_at: new Date(Date.now() + 30_000).toISOString(), latitude: 47.04, longitude: 8.69, accuracy_m: 8 };
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [reading] }), 'record_trail'), null, 'an Alerted Adventure takes Trail readings');
  const map = await trailMap(token);
  assert.equal(map.status, 'alerted', 'the Trail Map says the Alert went out');
  assert.equal(map.trail.length, 2, 'the Start reading and the Alerted reading');
  assert.equal(map.last_known_position.latitude, 47.04, 'the Last Position is the Alerted reading');
});
