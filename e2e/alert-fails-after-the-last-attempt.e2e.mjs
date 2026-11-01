import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, runDeliver, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/local-messages.md § Text messages "While it is not running, each text message is retried six times over about 18 minutes and then becomes a Delivery Failure."
// The Alert below is one whose sixth attempt (private.max_attempts()) got no answer: a deliver run claimed it and its lease ran out.
test('an Alert text message whose sixth attempt got no answer becomes a Delivery Failure and is not sent again', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const [lastAttempt] = must(
    await admin
      .from('messages')
      .insert({
        adventure_id: id, kind: 'alert', round: 1, channel: 'sms', to_address: anna.sara.phone, contact_id: anna.sara.id,
        status: 'sending', attempts: 6, lease_until: new Date(Date.now() - 1000).toISOString(),
      })
      .select('id'),
    'an Alert on its last attempt',
  );
  await runDeliver();

  assert.deepEqual(
    must(await admin.from('messages').select('status, failure_reason').eq('id', lastAttempt.id).single(), 'the Alert'),
    { status: 'failed', failure_reason: 'retries_exhausted' },
    'the Alert fails once its retries are exhausted',
  );
  assert.ok(!(await textsTo(anna.sara.phone)).some((m) => m.body.startsWith('Anna has not checked in')), 'and it is not sent a seventh time');
  assert.deepEqual(
    must(await anna.client.from('adventure_messages').select('kind, round, channel, status, failure_reason').eq('id', lastAttempt.id), 'adventure_messages'),
    [{ kind: 'alert', round: 1, channel: 'sms', status: 'failed', failure_reason: 'retries_exhausted' }],
    'Anna’s app lists the Alert to Sara as failed',
  );
  assert.deepEqual(
    must(await anna.client.from('delivery_failures').select('kind, contact_name, failure_reason').eq('adventure_id', id), 'Delivery Failures'),
    [{ kind: 'alert', contact_name: 'Sara', failure_reason: 'retries_exhausted' }],
    'and as a Delivery Failure',
  );
});
