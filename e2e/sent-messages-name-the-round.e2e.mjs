import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, appMessages, hourAfterAlert, messagesOut, missDeadline, must, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Sent to your contacts "Each row names the message, with the round of an Alert ("Alert 2 of 3"), every contact on its address, the channel and the address, and its outcome with the time: Sent, Delivered, or Failed."
test('each row names the message, with the round of an Alert', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id);
  tick();
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');

  await hourAfterAlert(id);
  await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)');
  await waitForText(anna.sara.phone, 'Anna has still not checked in from an adventure (alert 2 of 3)');
  await messagesOut(id);

  const listed = must(await appMessages(anna.client, id), 'adventure_messages');
  assert.deepEqual(
    listed.filter((m) => m.kind === 'alert').map((m) => `${m.kind} ${m.round} ${m.channel}`).sort(),
    ['alert 1 email', 'alert 1 sms', 'alert 2 email', 'alert 2 sms'],
    'Anna lists Alert 1 and Alert 2 to each address, each with its round',
  );
});
