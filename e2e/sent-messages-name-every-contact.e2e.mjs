import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, messagesOut, must, waitForMail } from './stack.mjs';

// The select of the list in src/lib/barry/client.ts (MESSAGE_SELECT in src/lib/barry/rows.ts).
const MESSAGE_SELECT = 'id, kind, round, channel, to_address, contacts, status, delivered, outcome_at, failure_reason, undelivered';

// docs/spec.md § Messages > Sent to your contacts "Each row names the message, with the round of an Alert ("Alert 2 of 3"), every contact on its address, the channel and the address, and its outcome with the time: Sent, Delivered, or Failed."
test('each row names every contact on its address', async () => {
  const anna = await adventurer();
  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email });

  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
      p_contact_ids: [anna.luca.id, anna.sara.id, mia.id],
    }),
    'save_adventure',
  );
  const id = saved.adventure_id;
  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start'),
    null,
  );
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await messagesOut(id);

  const listed = must(await anna.client.from('adventure_messages').select(MESSAGE_SELECT).eq('adventure_id', id), 'adventure_messages');
  const email = listed.filter((m) => m.kind === 'heads_up' && m.channel === 'email');
  assert.equal(email.length, 1, 'one Heads-up email to the shared address');
  assert.deepEqual(
    email[0].contacts,
    [{ id: anna.luca.id, name: 'Luca' }, { id: mia.id, name: 'Mia' }],
    'the Heads-up email row names Luca and Mia, who share its address',
  );
});
