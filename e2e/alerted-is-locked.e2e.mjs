import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, missDeadline, must, waitForMail } from './stack.mjs';

// docs/spec.md:71 "The Adventure cannot be cancelled. A Check-in is the only way to end it."
// docs/spec.md:79 "Alerted. The Adventurer can move the Deadline later, but cannot edit the Adventure. A Check-in is the only way to end it."
test('an Alerted Adventure refuses an edit and a deletion, and only the Check-in ends it', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: id }), 'delete_adventure'), 'wrong_stage', 'an Active Adventure cannot be cancelled');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  const before = must(await admin.from('adventures').select('stage, deadline, route').eq('id', id).single(), 'adventure');
  assert.equal(before.stage, 'alerted');

  const [edit] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'West ridge', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  assert.equal(edit.refusal, 'wrong_stage', 'the Adventure cannot be edited after the Alert');
  assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: id }), 'delete_adventure'), 'wrong_stage', 'an Alerted Adventure cannot be cancelled');
  assert.deepEqual(must(await admin.from('adventures').select('stage, deadline, route').eq('id', id).single(), 'adventure'), before, 'stage, Deadline and Plan are unchanged');
  assert.equal(await mailCount(anna.luca.email, 'Anna changed the plan'), 0, 'no Plan Update went out');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'ended', 'the Check-in ends it');
});
