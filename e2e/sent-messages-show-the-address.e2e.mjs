import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, messagesOut, must, waitForMail, waitForText } from './stack.mjs';

// The select of the list in src/lib/barry/client.ts (MESSAGE_SELECT in src/lib/barry/rows.ts).
const MESSAGE_SELECT = 'id, kind, round, channel, to_address, contacts, status, delivered, outcome_at, failure_reason, undelivered';

// docs/spec.md § Messages > Sent to your contacts "Each row names the message, with the round of an Alert ("Alert 2 of 3"), every contact on its address, the channel and the address, and its outcome with the time: Sent, Delivered, or Failed."
test('each row shows the channel and the address', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  await messagesOut(id);

  const listed = must(await anna.client.from('adventure_messages').select(MESSAGE_SELECT).eq('adventure_id', id), 'adventure_messages');
  assert.deepEqual(
    listed.map((m) => `${m.kind} ${m.channel} ${m.to_address}`).sort(),
    [`heads_up email ${anna.luca.email}`, `heads_up sms ${anna.sara.phone}`],
    'Anna lists Luca’s Heads-up by email to his address and Sara’s by text message to her number',
  );
});
