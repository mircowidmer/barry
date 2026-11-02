import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, must, runDeliver, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Edit an Active or Overdue Adventure "A change to the destination sends a Plan Update to each contact whose
// Heads-up already went out. A contact whose Heads-up is still on its way gets no Plan Update, because the Heads-up carries the latest Plan."
test('a contact whose Heads-up is still on its way gets no Plan Update, because the Heads-up carries the latest Plan', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  // Mia joined while deliver was busy: her Heads-up is claimed and on its way, and nothing sends it until the lease below is released.
  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  must(await admin.from('adventure_contacts').insert({ adventure_id: id, contact_id: mia.id }), 'Mia on the Adventure');
  const [held] = must(
    await admin
      .from('messages')
      .insert({
        adventure_id: id, kind: 'heads_up', channel: 'email', to_address: mia.email, contact_id: mia.id,
        status: 'sending', attempts: 1, lease_until: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .select('id'),
    'a Heads-up still on its way',
  );

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id, mia.id],
    }),
    'save_adventure',
  );
  const waiting = (await messageKinds(id)).filter((m) => m.kind === 'plan_update').map((m) => m.to_address).sort();
  assert.deepEqual(waiting, [anna.luca.email, anna.sara.phone].sort(), 'Luca and Sara get a Plan Update; Mia, whose Heads-up is still on its way, gets none');
  await waitForMail(anna.luca.email, 'Anna changed the plan for Kleiner Mythen');

  must(await admin.from('messages').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('id', held.id), 'release the lease');
  await runDeliver();
  const headsUp = await waitForMail(mia.email, 'Anna is heading out to Kleiner Mythen');
  assert.match(headsUp.Text, /Destination: Kleiner Mythen/, 'her Heads-up carries the latest Plan');
  assert.equal(await mailCount(mia.email, 'Anna changed the plan'), 0, 'Mia gets no Plan Update');
});
