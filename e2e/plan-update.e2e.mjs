import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, must, waitForMail, waitForText } from './stack.mjs';

test('a Plan change sends a Plan Update to the contacts so far and a Heads-up to a new one', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'East ridge', p_starting_point: 'Brunni car park',
      p_notes: 'Bring a headlamp', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id, mia.id],
    }),
    'save_adventure',
  );

  const update = await waitForMail(anna.luca.email, 'Anna changed the plan for Grosser Mythen');
  assert.match(update.Text, /Notes: Bring a headlamp/);
  const updateText = await waitForText(anna.sara.phone, 'Anna changed the plan');
  assert.match(updateText.body, /Notes: Bring a headlamp/);
  const miaHeadsUp = await waitForMail(mia.email, 'Anna is heading out to Grosser Mythen');
  assert.match(miaHeadsUp.Text, /Notes: Bring a headlamp/);
  assert.equal(await mailCount(mia.email, 'Anna changed the plan'), 0, 'the new contact gets no Plan Update');
});
