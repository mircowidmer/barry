import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, paceOver, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventurer Profile "Only the Alert carries the full Profile, and it leaves the phone line out when there is no phone number."
test('only the Alert carries the full Profile: the Plan Update, the Deadline Update and the All-clear leave it out', async () => {
  const anna = await adventurer();
  must(await anna.client.from('adventurer_profiles').update({ medical_notes: 'Type 1 diabetic' }).eq('id', anna.userId), 'medical notes');
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  await paceOver(id);
  const planUpdate = await waitForMail(anna.luca.email, 'Anna changed the plan for Kleiner Mythen');
  const planUpdateText = await waitForText(anna.sara.phone, 'Anna changed the plan');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  await paceOver(id);
  const deadlineUpdate = await waitForMail(anna.luca.email, 'Anna needs more time for Kleiner Mythen');
  const deadlineUpdateText = await waitForText(anna.sara.phone, 'Anna needs more time');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  const allClear = await waitForMail(anna.luca.email, 'Anna is back safe');
  const allClearText = await waitForText(anna.sara.phone, 'Anna checked in safely');

  const profile = /\+41790000001|Subaru|SZ 12345|Type 1 diabetic|Anna's phone|Car:|Medical notes/;
  for (const [what, body] of [
    ['the Plan Update email', planUpdate.Text],
    ['the Plan Update text message', planUpdateText.body],
    ['the Deadline Update email', deadlineUpdate.Text],
    ['the Deadline Update text message', deadlineUpdateText.body],
    ['the All-clear email', allClear.Text],
    ['the All-clear text message', allClearText.body],
  ]) {
    assert.doesNotMatch(body, profile, `${what} carries none of the Profile’s phone, car or medical notes`);
  }
});
