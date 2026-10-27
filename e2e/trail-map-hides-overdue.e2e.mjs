import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md § Trail Map "The page does not show the Deadline, and it does not show that the Adventure is Overdue."
test('the Trail Map shows an Overdue Adventure as underway, without the Deadline', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  await missDeadline(id, 0.2);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue');

  const map = await trailMap(token);
  assert.equal(map.status, 'underway', 'the page does not show that the Adventure is Overdue');
  assert.equal('deadline' in map, false, 'the page does not show the Deadline');
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
});
