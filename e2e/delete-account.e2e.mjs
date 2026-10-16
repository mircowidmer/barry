import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, must, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

test('deleting the account is refused during an Adventure, and afterwards removes everything', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  assert.equal(must(await anna.client.rpc('delete_account'), 'delete_account'), 'adventure_in_progress');
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  assert.equal(must(await anna.client.rpc('delete_account'), 'delete_account'), null);

  const { data } = await admin.auth.admin.getUserById(anna.userId);
  assert.equal(data.user, null, 'the sign-in is gone');
  assert.equal(await trailMap(token), null, 'the Trail Map link stops working');
  assert.deepEqual(await messageKinds(id), [], 'the messages are gone');
});
