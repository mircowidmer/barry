import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, missDeadline, must, tick, waitForMail, waitForText } from './stack.mjs';

// CONTEXT.md:68 "Overdue: An Adventure whose Deadline has passed and whose Grace Period is still running. Nobody has been told yet."
// docs/spec.md:69 "| Alerted | The Grace Period ends without a Check-in. | Active, Ended |"
test('nobody is told while the Grace Period runs, and the Alert follows once it has ended', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const stage = async () => must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure').stage;

  await missDeadline(id, 4);
  tick();
  assert.equal(await stage(), 'overdue', 'the Deadline passed and the Grace Period still runs');
  assert.equal((await messageKinds(id)).some((m) => m.kind === 'alert'), false, 'no Alert is queued while the Grace Period runs');
  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0, 'Luca has not been told');

  await missDeadline(id, 6);
  tick();
  assert.equal(await stage(), 'alerted', 'the Grace Period ended without a Check-in');
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
});
