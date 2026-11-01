import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, messagesOut, must, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

// The select and the order of the list in src/lib/barry/client.ts (MESSAGE_SELECT in src/lib/barry/rows.ts).
const MESSAGE_SELECT = 'id, kind, round, channel, to_address, contacts, status, delivered, outcome_at, failure_reason, undelivered';

// docs/spec.md § Messages > Sent to your contacts "Rows of a contact removed from the Adventure stay."
test('the rows of a contact removed from the Adventure stay in the list of sent messages', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const saraToken = trailToken((await waitForText(anna.sara.phone, 'Anna is going on an adventure alone')).body);
  await messagesOut(id);

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_deadline: null, p_contact_ids: [anna.luca.id],
    }),
    'remove Sara from the Adventure',
  );
  assert.equal(await trailMap(saraToken), null, 'Sara is no longer a contact of the Adventure');

  const listed = must(
    await anna.client.from('adventure_messages').select(MESSAGE_SELECT).eq('adventure_id', id)
      .order('outcome_at', { ascending: false }).order('id', { ascending: false }),
    'adventure_messages',
  );
  assert.deepEqual(
    listed.map((m) => `${m.kind} ${m.channel} ${m.to_address} ${m.contacts.map((c) => c.name).join(',')}`).sort(),
    [`heads_up email ${anna.luca.email} Luca`, `heads_up sms ${anna.sara.phone} Sara`],
    'Anna still lists Sara’s Heads-up with Sara on her phone number',
  );
  const sara = listed.find((m) => m.to_address === anna.sara.phone);
  assert.deepEqual(sara.contacts, [{ id: anna.sara.id, name: 'Sara' }]);
  assert.equal(sara.status, 'sent');
});
