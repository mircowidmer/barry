import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, heartbeatsSince, must, runDeliver, waitForMail } from './stack.mjs';

test('deliver pings the monitor, names a failed Alert in a /fail, and recovers once it is old', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  let since = new Date();
  assert.deepEqual(await runDeliver(), { clock_ok: true, adventures_ok: true, outbox_ok: true, delivery_ok: true });
  const healthy = (await heartbeatsSince(since)).at(-1);
  assert.deepEqual([healthy?.failed, healthy?.body], [false, ''], 'a healthy run sends a plain ping with no problems');

  const [failedAlert] = must(
    await admin
      .from('messages')
      .insert({
        adventure_id: id, kind: 'alert', round: 1, channel: 'email', to_address: anna.luca.email,
        contact_id: anna.luca.id, status: 'failed', failure_reason: 'HTTP 403: Resend validation_error',
      })
      .select('id'),
    'a failed Alert',
  );

  since = new Date();
  assert.equal((await runDeliver()).delivery_ok, false, 'health() reports the failed Alert');
  assert.ok(
    (await heartbeatsSince(since)).some((h) => h.failed && h.body.split(', ').includes('delivery_ok')),
    'the monitor gets a /fail that names delivery_ok',
  );

  must(
    await admin.from('messages').update({ settled_at: new Date(Date.now() - 20 * 60_000).toISOString() }).eq('id', failedAlert.id),
    'age the failed Alert past 15 minutes',
  );
  since = new Date();
  assert.equal((await runDeliver()).delivery_ok, true, 'an Alert that failed over 15 minutes ago no longer counts');
  const recovered = (await heartbeatsSince(since)).at(-1);
  assert.equal(recovered?.failed, false, 'the monitor gets a plain ping again');
});
