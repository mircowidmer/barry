import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, missDeadline, must, tick, waitForMail } from './stack.mjs';

// docs/spec.md § Messages "Alert | Each contact of the Adventure | Every channel the contact has | The Grace Period ends"
// docs/spec.md § Adventures > Rules by stage "Active and Overdue. The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later."
test('a contact added to an Overdue Adventure gets the Alert when the Grace Period ends, and the All-clear after the Check-in', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id, 4.5);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue', 'the Adventure is Overdue and the Grace Period still runs');

  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id, mia.id],
    }),
    'add Mia',
  );
  assert.equal(saved.refusal, null, 'an Overdue Adventure takes a new contact');
  await waitForMail(mia.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id);
  const alert = await waitForMail(mia.email, 'Anna has not checked in');
  assert.match(alert.Text, /Anna has not checked in from an adventure\./, 'Mia gets the Alert');
  await waitForMail(anna.luca.email, 'Anna has not checked in');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(mia.email, 'Anna is back safe');

  const kinds = (await messageKinds(id)).filter((m) => m.to_address === mia.email).map((m) => m.kind).sort();
  assert.deepEqual(kinds, ['alert', 'all_clear', 'heads_up'], 'Mia got the Heads-up, the Alert and the All-clear, once each');
});
