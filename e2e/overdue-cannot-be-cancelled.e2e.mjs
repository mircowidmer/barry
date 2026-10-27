import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, waitForMail } from './stack.mjs';

// docs/spec.md § Adventures > Rules by stage "Active and Overdue. ... The Adventure cannot be cancelled. A Check-in is the only way to end it."
test('an Overdue Adventure refuses a deletion, and only the Check-in ends it', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id, 0.2);
  tick();
  const stage = async () => must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure').stage;
  assert.equal(await stage(), 'overdue', 'the clock marked the Adventure Overdue');

  assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: id }), 'delete_adventure'), 'wrong_stage', 'an Overdue Adventure cannot be cancelled');
  assert.equal(await stage(), 'overdue', 'it is still Overdue');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  assert.equal(await stage(), 'ended', 'the Check-in ends it');
});
