import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, must, runDeliver, tick, waitForMail } from './stack.mjs';

// docs/hosted-supabase.md:147 "Once Barry runs again, a waiting Alert goes out by itself. A failed one does not: call or
// message those Emergency Contacts yourself."
// docs/spec.md § Messages > Delivery Failures "If a Heads-up, a Plan Update, a Deadline Update, an Alert, or an All-clear cannot be delivered, the app
// shows the Delivery Failure to the Adventurer."
test('an Alert that failed is not resent by the clock or by deliver, and the Adventurer sees it as a Delivery Failure', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  must(
    await admin.from('messages').insert({
      adventure_id: id, kind: 'alert', round: 1, channel: 'email', to_address: anna.luca.email,
      contact_id: anna.luca.id, status: 'failed', failure_reason: 'HTTP 403: Resend validation_error',
    }),
    'a failed Alert',
  );
  await runDeliver();
  tick();
  await runDeliver();

  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0, 'no Alert went out');
  assert.deepEqual((await messageKinds(id)).filter((m) => m.kind === 'alert').map((m) => m.status), ['failed'], 'the Alert stays failed');
  assert.deepEqual(
    must(await anna.client.from('delivery_failures').select('kind, to_address, failure_reason').eq('adventure_id', id), 'Delivery Failures'),
    [{ kind: 'alert', to_address: anna.luca.email, failure_reason: 'HTTP 403: Resend validation_error' }],
    'Anna sees that the Alert to Luca did not arrive',
  );
});
