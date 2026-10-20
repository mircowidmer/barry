import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, must, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:109 "Changing only the contacts, or moving the Deadline, sends no Plan Update."
test('moving the Deadline sends a Deadline Update and no Plan Update', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  must(
    await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'),
    'skip the three-minute wait',
  );
  await waitForMail(anna.luca.email, 'Anna needs more time for Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna needs more time');

  assert.equal((await messageKinds(id)).some((m) => m.kind === 'plan_update'), false, 'no Plan Update was queued');
  assert.equal(await mailCount(anna.luca.email, 'Anna changed the plan'), 0, 'Luca got no Plan Update');
  assert.equal((await textsTo(anna.sara.phone)).some((m) => m.body.startsWith('Anna changed the plan')), false, 'Sara got no Plan Update');
});
