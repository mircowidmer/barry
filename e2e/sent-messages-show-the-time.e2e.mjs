import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, appMessages, messagesOut, must, poll, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Sent to your contacts "Each row names the message, with the round of an Alert ("Alert 2 of 3"), every contact on its address, the channel and the address, and its outcome with the time: Sent, Delivered, or Failed."
test('each row shows its outcome with the time', async () => {
  const anna = await adventurer();
  const started = Date.now();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  await messagesOut(id);

  // The local relay confirms each text message half a second after it accepted it, like Twilio's status callback.
  const listed = await poll('Delivered text message in the list', async () => {
    const found = must(await appMessages(anna.client, id), 'adventure_messages');
    return found.some((m) => m.channel === 'sms' && m.delivered) && found;
  });
  const now = Date.now();
  assert.equal(listed.length, 2, 'Anna lists both Heads-ups');
  for (const m of listed) {
    const at = new Date(m.outcome_at).getTime();
    assert.ok(started <= at && at <= now, `the ${m.channel} row's time ${m.outcome_at} lies between the Start and now`);
  }

  const settled = Object.fromEntries(
    must(await admin.from('messages').select('channel, settled_at, delivered_at').eq('adventure_id', id), 'messages').map((m) => [m.channel, m]),
  );
  const email = listed.find((m) => m.channel === 'email');
  const sms = listed.find((m) => m.channel === 'sms');
  assert.deepEqual([email.status, email.delivered], ['sent', false]);
  assert.equal(new Date(email.outcome_at).getTime(), new Date(settled.email.settled_at).getTime(), 'the email is Sent at the time it went out');
  assert.deepEqual([sms.status, sms.delivered], ['sent', true]);
  assert.equal(new Date(sms.outcome_at).getTime(), new Date(settled.sms.delivered_at).getTime(), 'the text message is Delivered at the time Twilio reported it');
});
