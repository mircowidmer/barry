import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { admin, adventurer, heartbeatsSince, missDeadline, must, runDeliver, sleep, waitForMail, waitForText } from './stack.mjs';

// docs/text-messages.md § Delivery reports "an undelivered Alert makes `health()` report `delivery_ok = false` to the monitor."
// The local relay reports a text message to a number ending in 30003 as undelivered, like Twilio.
// health() covers the whole stack, so this case only asserts the failure its own undelivered Alert causes, never health.
test('an Alert text message Twilio reports undelivered makes health() report delivery_ok = false to the monitor', async () => {
  const anna = await adventurer();
  const unreachable = `+41790${String(randomInt(100)).padStart(2, '0')}30003`;
  must(await anna.client.from('emergency_contacts').update({ phone: unreachable }).eq('id', anna.sara.id), 'give Sara an unreachable number');

  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await missDeadline(id);
  await waitForText(unreachable, 'Anna has not checked in from an adventure');

  const alert = async () =>
    must(await admin.from('messages').select('status, failure_reason').eq('adventure_id', id).eq('kind', 'alert').eq('channel', 'sms').single(), 'the Alert text');
  let row = await alert();
  for (let tries = 0; tries < 20 && row.status !== 'failed'; tries++) {
    await sleep(1);
    row = await alert();
  }
  assert.deepEqual(row, { status: 'failed', failure_reason: 'Twilio 30003: Unreachable destination handset' }, 'Twilio reported the Alert to Sara undelivered');

  const since = new Date();
  assert.equal((await runDeliver()).delivery_ok, false, 'health() reports delivery_ok = false');
  assert.ok(
    (await heartbeatsSince(since)).some((h) => h.failed && h.body.split(', ').includes('delivery_ok')),
    'the monitor gets a /fail that names delivery_ok',
  );
});
