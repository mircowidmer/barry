import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventurer Profile "Message language | Decides the language of every message to the contacts"
test('the Plan Update and the Deadline Update are German for an Adventurer who chose German', async () => {
  const anna = await adventurer();
  must(await anna.client.from('adventurer_profiles').update({ message_language: 'de' }).eq('id', anna.userId), 'choose German');
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna ist unterwegs: Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna ist allein auf einem Abenteuer');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const planUpdate = await waitForMail(anna.luca.email, 'Anna hat den Plan für Kleiner Mythen geändert');
  assert.match(planUpdate.Text, /^Anna hat den Plan geändert/);
  assert.match(planUpdate.Text, /Ziel: Kleiner Mythen/);
  await waitForText(anna.sara.phone, 'Anna hat den Plan geändert');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  must(await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'), 'skip the three-minute wait');
  const deadlineUpdate = await waitForMail(anna.luca.email, 'Anna braucht mehr Zeit für Kleiner Mythen');
  assert.match(deadlineUpdate.Text, /^Anna braucht mehr Zeit und hat die Rückkehrzeit von .+ auf .+ verschoben/);
  await waitForText(anna.sara.phone, 'Anna braucht mehr Zeit');
});
