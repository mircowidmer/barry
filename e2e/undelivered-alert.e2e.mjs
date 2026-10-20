import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, missDeadline, must, sleep, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:162 "If a Heads-up, a Plan Update, a Deadline Update, an Alert, or an All-clear cannot be delivered, the app
// shows the Delivery Failure to the Adventurer. That includes a text message that Twilio accepted but later reports as not
// delivered."
// The local relay reports a text message to a number ending in 30003 as undelivered, like Twilio.
test('an Alert text message that Twilio reports as undelivered shows as a Delivery Failure, and the email Alert still arrives', async () => {
  const anna = await adventurer();
  const unreachable = `+41790${String(randomInt(100)).padStart(2, '0')}30003`;
  must(await anna.client.from('emergency_contacts').update({ phone: unreachable }).eq('id', anna.sara.id), 'give Sara an unreachable number');

  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(unreachable, 'Anna has not checked in from an adventure');

  const alertFailures = async () =>
    must(await anna.client.from('delivery_failures').select('kind, round, to_address, contact_name, failure_reason').eq('adventure_id', id).eq('kind', 'alert'), 'Delivery Failures');
  let failures = [];
  for (let tries = 0; tries < 20 && failures.length === 0; tries++) {
    if (tries > 0) await sleep(1);
    failures = await alertFailures();
  }
  assert.deepEqual(
    failures,
    [{ kind: 'alert', round: 1, to_address: unreachable, contact_name: 'Sara', failure_reason: 'Twilio 30003: Unreachable destination handset' }],
    'Anna sees that the Alert to Sara did not arrive, and Luca’s Alert is no Delivery Failure',
  );
});
