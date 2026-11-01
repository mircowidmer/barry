import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md § Location "It keeps every reading taken since the Start that it gets for an Active, Overdue or Alerted Adventure,
// and drops only a second reading in the same `slot` window, which is seconds long, not minutes."
test('the Trail keeps every reading taken since the Start, and none taken before it', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  const reading = (takenAt, latitude) => ({ taken_at: takenAt.toISOString(), latitude, longitude: 8.69, accuracy_m: 8 });
  const beforeStart = reading(new Date(Date.now() - 3600_000), 46.99);
  const sinceStart = reading(new Date(Date.now() + 60_000), 47.04);
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [beforeStart, sinceStart] }), 'record_trail'), null);

  const trail = (await trailMap(token)).trail.map(([latitude, longitude]) => [latitude, longitude]);
  assert.deepEqual(trail, [[47.03, 8.68], [47.04, 8.69]], 'the Trail holds the Start reading and the later one, not the one from an hour before the Start');
});
