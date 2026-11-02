import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md § Trail Map "The page shows the Adventurer's name, the Plan, the Trail as a line on a map drawn from OpenStreetMap data,
// and the Last Position with the time of the reading."
// .claude/skills/barry-frontend-verify/features/trail.md § Sub-features "`trail-map` shows `<name>'s Adventure`, the line, `Last position on …` and the Plan"
test('the Trail Map shows the Last Position with the time of the reading', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  // record_trail takes readings up to two minutes ahead, so a reading 90 seconds ahead is newer than the Start reading.
  const takenAt = new Date(Date.now() + 90_000);
  assert.equal(
    must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [{ taken_at: takenAt.toISOString(), latitude: 47.12345, longitude: 8.54321, accuracy_m: 7 }] }), 'record_trail'),
    null,
  );

  const last = (await trailMap(token)).last_known_position;
  assert.equal(new Date(last.taken_at).toISOString(), takenAt.toISOString(), 'the Last Position gives the time of the reading');
  assert.deepEqual([last.latitude, last.longitude], [47.12345, 8.54321], 'the Last Position is that reading');
});
