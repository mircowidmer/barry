import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, assertClockRan, mailCount, messageKinds, missDeadline, must, sleep, tick, waitForMail } from './stack.mjs';

// docs/spec.md:61 "Active | Supabase confirms the Start, or the Adventurer moves the Deadline of an Overdue Adventure."
// docs/spec.md:98 "Moving the Deadline of an Overdue or Alerted Adventure makes it Active again."
test('moving the Deadline of an Adventure the clock marked Overdue makes it Active again, and no Alert goes out', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id, 4.5);
  tick();
  const stage = async () => must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure').stage;
  assert.equal(await stage(), 'overdue', 'the clock marked the Adventure Overdue');

  const later = new Date(Date.now() + 2 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  assert.equal(await stage(), 'active', 'the move makes it Active again');

  await sleep(90);
  await assertClockRan();
  assert.equal(await stage(), 'active', 'it stays Active');
  assert.equal((await messageKinds(id)).some((m) => m.kind === 'alert'), false, 'no Alert was queued');
  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0);
});
