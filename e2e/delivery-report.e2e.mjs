import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { admin, adventurer, must, sleep, waitForText } from './stack.mjs';

// The local relay reports a text message to a number ending in 30003 as undelivered, like Twilio.
test('Twilio’s delivery reports mark a text message delivered, or a Delivery Failure when it does not arrive', async () => {
  const anna = await adventurer();
  const unreachable = `+41790${String(randomInt(100)).padStart(2, '0')}30003`;
  must(await anna.client.from('emergency_contacts').update({ phone: unreachable }).eq('id', anna.sara.id), 'give Sara an unreachable number');
  const reachable = `+4179${String(randomInt(1e7)).padStart(7, '0')}`;
  must(await anna.client.from('emergency_contacts').update({ phone: reachable }).eq('id', anna.luca.id), 'give Luca a phone number');

  const id = await anna.start();
  await waitForText(unreachable, 'Anna is going on an adventure alone');
  await waitForText(reachable, 'Anna is going on an adventure alone');

  let rows = [];
  for (let tries = 0; tries < 20; tries++) {
    rows = must(
      await admin.from('messages').select('to_address, status, failure_reason, delivered_at').eq('adventure_id', id).eq('channel', 'sms'),
      'messages',
    );
    if (rows.every((m) => m.delivered_at || m.status === 'failed')) break;
    await sleep(1);
  }
  const byNumber = Object.fromEntries(rows.map((m) => [m.to_address, m]));
  assert.ok(byNumber[reachable].delivered_at, 'Luca’s Heads-up text is reported delivered');
  assert.equal(byNumber[reachable].status, 'sent');
  assert.equal(byNumber[unreachable].status, 'failed', 'Sara’s Heads-up is reported undelivered');
  assert.equal(byNumber[unreachable].failure_reason, 'Twilio 30003: Unreachable destination handset');

  const failures = must(await anna.client.from('delivery_failures').select('kind, to_address, failure_reason').eq('adventure_id', id), 'Delivery Failures');
  assert.deepEqual(
    failures,
    [{ kind: 'heads_up', to_address: unreachable, failure_reason: 'Twilio 30003: Unreachable destination handset' }],
    'Anna sees that Sara’s Heads-up did not arrive',
  );
});
