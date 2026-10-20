import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, heartbeatsSince, must, runDeliver, sleep, waitForMail } from './stack.mjs';

// health() covers the whole stack, and files running beside this one fail an Alert on purpose, such as
// undelivered-alert.e2e.mjs, until they delete their account. So a healthy run is awaited, not assumed.
const healthyRun = async () => {
  const deadline = Date.now() + 150_000;
  for (;;) {
    const since = new Date();
    const health = await runDeliver();
    if (Object.values(health).every(Boolean) || Date.now() > deadline) return { health, ping: (await heartbeatsSince(since)).at(-1) };
    await sleep(2);
  }
};

test('deliver pings the monitor, names a failed Alert in a /fail, and recovers once it is old', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  const healthy = await healthyRun();
  assert.deepEqual(healthy.health, { clock_ok: true, adventures_ok: true, outbox_ok: true, delivery_ok: true });
  assert.deepEqual([healthy.ping?.failed, healthy.ping?.body], [false, ''], 'a healthy run sends a plain ping with no problems');

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

  const since = new Date();
  assert.equal((await runDeliver()).delivery_ok, false, 'health() reports the failed Alert');
  assert.ok(
    (await heartbeatsSince(since)).some((h) => h.failed && h.body.split(', ').includes('delivery_ok')),
    'the monitor gets a /fail that names delivery_ok',
  );

  must(
    await admin.from('messages').update({ settled_at: new Date(Date.now() - 20 * 60_000).toISOString() }).eq('id', failedAlert.id),
    'age the failed Alert past 15 minutes',
  );
  const recovered = await healthyRun();
  assert.equal(recovered.health.delivery_ok, true, 'an Alert that failed over 15 minutes ago no longer counts');
  assert.equal(recovered.ping?.failed, false, 'the monitor gets a plain ping again');
});
