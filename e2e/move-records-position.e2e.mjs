import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md:91 "Each move records a new Last Position."
// docs/spec.md:170 "The Last Position is the newest reading, from Start, a Deadline move, or the Trail."
test('a Deadline move records a new Last Position, which the Trail Map and the Alert show', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(
    must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later, p_latitude: 47.04, p_longitude: 8.69, p_accuracy_m: 10 }), 'move_deadline'),
    null,
  );
  const map = await trailMap(token);
  assert.equal(map.last_known_position.latitude, 47.04, 'the reading from the move is the Last Position');
  assert.deepEqual(map.trail.map(([latitude]) => latitude), [47.03, 47.04], 'the Trail Map holds the reading from Start and the one from the move');

  await missDeadline(id);
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /Last position at .+: 47\.04000, 8\.69000/, 'the Alert gives the position from the move');
});
