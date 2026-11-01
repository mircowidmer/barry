import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messagesOut, must, sleep, waitForMail, waitForText } from './stack.mjs';

// The select of the list in src/lib/barry/client.ts (MESSAGE_SELECT in src/lib/barry/rows.ts).
const MESSAGE_SELECT = 'id, kind, round, channel, to_address, contacts, status, delivered, outcome_at, failure_reason, undelivered';

// docs/spec.md § Messages > Sent to your contacts "Each row names the message, with the round of an Alert ("Alert 2 of 3"), every contact on its address, the channel and the address, and its outcome with the time: Sent, Delivered, or Failed."
test('each row shows its outcome with the time', async () => {
  const anna = await adventurer();
  const started = Date.now();
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
