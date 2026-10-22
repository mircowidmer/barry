import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, assertClockRan, mailCount, messageKinds, missDeadline, must, sleep, waitForMail } from './stack.mjs';

test('moving the Deadline of an overdue Adventure keeps the Alert from going out', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id, 4.5);
  const later = new Date(Date.now() + 2 * 3600_000).toISOString();
  assert.equal(
    must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later, p_latitude: 47.04, p_longitude: 8.69, p_accuracy_m: 10 }), 'move_deadline'),
    null,
  );
  const { stage } = must(await anna.client.from('adventures').select('stage').eq('id', id).single(), 'stage');
  assert.equal(stage, 'active');

  await sleep(90);
  await assertClockRan();
  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0);
  assert.equal((await messageKinds(id)).some((m) => m.kind === 'alert'), false, 'no Alert was queued');
});
