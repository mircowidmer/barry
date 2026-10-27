import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md § Location "It keeps every reading taken since the Start that it gets for an Active, Overdue or Alerted
// Adventure"
test('the Trail records while the Adventure is Overdue, and the Trail Map shows the new Last Position', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  await missDeadline(id, 0.2);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue', 'the clock marked the Adventure Overdue');

  const reading = { taken_at: new Date(Date.now() + 30_000).toISOString(), latitude: 47.04, longitude: 8.69, accuracy_m: 8 };
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [reading] }), 'record_trail'), null, 'an Overdue Adventure takes Trail readings');
  const map = await trailMap(token);
  assert.equal(map.trail.length, 2, 'the Start reading and the Overdue reading');
  assert.equal(map.last_known_position.latitude, 47.04, 'the Last Position is the Overdue reading');
});
