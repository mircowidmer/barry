import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages: the Heads-up goes out when "Supabase confirms the Start, or a contact is added to an Active or Overdue Adventure"
// docs/spec.md § Adventures > Rules by stage "Active and Overdue. The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later."
test('a contact added to an Overdue Adventure gets a Heads-up', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  await missDeadline(id, 0.2);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue');

  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id, mia.id],
    }),
    'add Mia',
  );
  assert.equal(saved.refusal, null, 'an Overdue Adventure takes a new contact');
  const headsUp = await waitForMail(mia.email, 'Anna is heading out to Grosser Mythen');
  assert.match(headsUp.Text, /Destination: Grosser Mythen/, 'Mia’s Heads-up carries the Plan');
});
