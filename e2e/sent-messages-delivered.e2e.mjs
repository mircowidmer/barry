import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, appMessages, messagesOut, must, poll, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Sent to your contacts "Only a text message becomes Delivered, once Twilio confirms it; an email stays Sent."
test('only a text message becomes Delivered once Twilio confirms it, and an email stays Sent', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  await messagesOut(id);

  // The local relay confirms each text message half a second after it accepted it, like Twilio's status callback.
  const listed = await poll('Delivered text message in the list', async () => {
    const found = must(await appMessages(anna.client, id), 'adventure_messages');
    return found.some((m) => m.channel === 'sms' && m.delivered) && found;
  });
  const sara = listed.find((m) => m.channel === 'sms');
  const luca = listed.find((m) => m.channel === 'email');
  assert.deepEqual([sara.status, sara.delivered], ['sent', true], 'Sara’s Heads-up text message is Delivered once Twilio confirms it');
  assert.deepEqual([luca.status, luca.delivered], ['sent', false], 'Luca’s Heads-up email stays Sent');
});
