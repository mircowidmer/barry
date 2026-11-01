import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, messagesOut, must, sleep, waitForMail, waitForText } from './stack.mjs';

// The select of the list in src/lib/barry/client.ts (MESSAGE_SELECT in src/lib/barry/rows.ts).
const MESSAGE_SELECT = 'id, kind, round, channel, to_address, contacts, status, delivered, outcome_at, failure_reason, undelivered';

// docs/spec.md § Messages > Sent to your contacts "Only a text message becomes Delivered, once Twilio confirms it; an email stays Sent."
test('only a text message becomes Delivered once Twilio confirms it, and an email stays Sent', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  await messagesOut(id);

  // The local relay confirms each text message half a second after it accepted it, like Twilio's status callback.
  let listed = [];
  for (let tries = 0; tries < 30; tries++) {
    listed = must(await anna.client.from('adventure_messages').select(MESSAGE_SELECT).eq('adventure_id', id), 'adventure_messages');
    if (listed.some((m) => m.channel === 'sms' && m.delivered)) break;
    await sleep(1);
  }
  const sara = listed.find((m) => m.channel === 'sms');
  const luca = listed.find((m) => m.channel === 'email');
  assert.deepEqual([sara.status, sara.delivered], ['sent', true], 'Sara’s Heads-up text message is Delivered once Twilio confirms it');
  assert.deepEqual([luca.status, luca.delivered], ['sent', false], 'Luca’s Heads-up email stays Sent');
});
