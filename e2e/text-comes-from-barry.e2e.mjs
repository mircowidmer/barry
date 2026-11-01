import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, waitForText } from './stack.mjs';

// docs/text-messages.md § Set up Twilio "For Swiss numbers, use the alphanumeric sender `Barry`."
// docs/local-messages.md § Text messages: the relay prints each text message as `texted <to> from Barry: <first line>`,
// since supabase/config.toml sets TWILIO_FROM = "Barry" as the local stand-in.
test('the text messages to a Swiss number come from the alphanumeric sender Barry', async () => {
  const anna = await adventurer();
  await anna.start();
  const headsUp = await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  assert.equal(headsUp.from, 'Barry', 'Sara’s Heads-up text message is from Barry');
});
