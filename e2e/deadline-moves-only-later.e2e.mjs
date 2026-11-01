import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, must, waitForMail } from './stack.mjs';

// docs/spec.md § Adventures > Rules by stage "The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later."
// docs/spec.md § Adventures > Move the Deadline "The Adventurer can move the Deadline later at any time until the Check-in, also after the
// Alert, as long as the new Deadline is in the future and its Alerts would not take the Adventure past nine."
test('the Adventurer can move the Deadline only later: an earlier Deadline, though still in the future, is refused', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const { deadline } = must(await admin.from('adventures').select('deadline').eq('id', id).single(), 'adventure');

  const earlier = new Date(new Date(deadline).getTime() - 3600_000);
  assert.ok(earlier.getTime() > Date.now(), 'the earlier Deadline is still in the future');
  assert.equal(
    must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: earlier.toISOString() }), 'move_deadline'),
    'deadline_not_later',
    'Supabase refuses a Deadline earlier than the current one',
  );

  const after = must(await admin.from('adventures').select('deadline, stage').eq('id', id).single(), 'adventure');
  assert.equal(new Date(after.deadline).getTime(), new Date(deadline).getTime(), 'the Deadline stays where it was');
  assert.equal(after.stage, 'active');
  assert.equal((await messageKinds(id)).some((m) => m.kind === 'deadline_update'), false, 'no Deadline Update is queued');
});
