import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, must, paceOver, runDeliver, sleep, waitForMail, waitForText } from './stack.mjs';

const WAIT_MS = 3 * 60_000;

// docs/spec.md § Adventures > Move the Deadline "The Deadline Update waits 3 minutes, and at least 15 minutes after the last Deadline Update to the same address."
test('the Deadline Update waits 3 minutes after a move', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  const waiting = must(
    await admin.from('messages').select('to_address, created_at, next_attempt_at').eq('adventure_id', id).eq('kind', 'deadline_update').eq('status', 'pending'),
    'pending Deadline Updates',
  );
  assert.deepEqual(waiting.map((m) => m.to_address).sort(), [anna.luca.email, anna.sara.phone].sort(), 'a Deadline Update waits for Luca and for Sara');
  for (const m of waiting) {
    assert.equal(new Date(m.next_attempt_at).getTime() - new Date(m.created_at).getTime(), WAIT_MS, `the Deadline Update to ${m.to_address} waits 3 minutes`);
  }

  await runDeliver();
  await sleep(5);
  assert.equal(await mailCount(anna.luca.email, 'Anna needs more time'), 0, 'Luca gets no Deadline Update before the 3 minutes are over');

  await paceOver(id);
  await runDeliver();
  await waitForMail(anna.luca.email, 'Anna needs more time for Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna needs more time');
});
