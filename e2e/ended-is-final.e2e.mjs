import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, must, waitForMail } from './stack.mjs';

// docs/spec.md:71 "| Ended | The Adventurer checks in. | Deleted |", and docs/spec.md:65-70 list no way back to another stage.
test('an Ended Adventure cannot be started, moved or edited again, and a second Check-in changes nothing', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  const before = (await messageKinds(id)).length;

  const later = new Date(Date.now() + 2 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), 'wrong_stage', 'the Deadline cannot be moved');
  assert.equal(must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich' }), 'start_adventure'), 'wrong_stage', 'it cannot be started again');
  const [edit] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'West ridge', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  assert.equal(edit.refusal, 'wrong_stage', 'the Plan cannot be edited');
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null, 'a second Check-in is accepted');

  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'ended', 'it stays Ended');
  assert.equal((await messageKinds(id)).length, before, 'no further message was queued');
  assert.equal(await mailCount(anna.luca.email, 'Anna is back safe'), 1, 'Luca got one All-clear');
});
