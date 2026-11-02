import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, messageKinds, messagesOut, must, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Edit an Active or Overdue Adventure "Changing only the contacts, moving the Deadline, or moving the destination on the map sends no Plan Update."
// docs/spec.md § Adventures > Edit an Active or Overdue Adventure "A contact added to the Adventure gets a Heads-up."
test('changing only the contacts sends no Plan Update, and the added contact gets a Heads-up', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id, mia.id],
    }),
    'save_adventure',
  );
  await waitForMail(mia.email, 'Anna is heading out to Grosser Mythen');
  await messagesOut(id);

  assert.equal((await messageKinds(id)).some((m) => m.kind === 'plan_update'), false, 'no Plan Update was queued');
  assert.equal(await mailCount(anna.luca.email, 'Anna changed the plan'), 0, 'Luca got no Plan Update');
  assert.equal((await textsTo(anna.sara.phone)).some((m) => m.body.startsWith('Anna changed the plan')), false, 'Sara got no Plan Update');
  assert.equal(await mailCount(mia.email, 'Anna changed the plan'), 0, 'Mia got no Plan Update');
});
