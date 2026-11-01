import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messagesOut, must, waitForText } from './stack.mjs';

// docs/text-messages.md § How `deliver` reads the answer "The message `sid` is stored as the provider reference."
test('the message sid Twilio answers with is stored as the provider reference', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const headsUp = await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  assert.match(headsUp.sid, /^SM[0-9a-f]{32}$/, 'the relay answered with a message sid');
  await messagesOut(id);

  const [row] = must(
    await admin.from('messages').select('provider_ref').eq('adventure_id', id).eq('kind', 'heads_up').eq('channel', 'sms').eq('to_address', anna.sara.phone),
    'Sara’s Heads-up text message',
  );
  assert.equal(row.provider_ref, headsUp.sid, 'Sara’s Heads-up row holds the sid of the text message she got');
});
