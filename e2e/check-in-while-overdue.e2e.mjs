import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, assertClockRan, mailCount, messageKinds, missDeadline, must, sleep, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:100 "A Check-in ends the Adventure and sends an All-clear to every contact, whether it comes before the
// Deadline, while Overdue, or after the Alert."
test('a Check-in while Overdue sends the All-clear, and no Alert follows', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  await missDeadline(id, 4.5);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue', 'the Adventure is Overdue and the Grace Period still runs');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  await sleep(90);
  await assertClockRan();
  assert.equal((await messageKinds(id)).some((m) => m.kind === 'alert'), false, 'no Alert was queued');
  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0, 'Luca got no Alert');
});
