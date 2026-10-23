import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, missDeadline, must, runDeliver, waitForMail } from './stack.mjs';

// docs/hosted-supabase.md:147 "Once Barry runs again, a waiting Alert goes out by itself."
// docs/adr/0001-server-owns-the-deadline.md:10 "The Deadline check itself is a single point of failure."
test('an Alert left waiting while deliver was down goes out by itself on the next run', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');

  // The clock queued the second round while deliver was down, so the row waits and nothing has sent it.
  must(
    await admin.from('messages').insert({
      adventure_id: id, kind: 'alert', round: 2, channel: 'email', to_address: anna.luca.email, contact_id: anna.luca.id, status: 'pending',
    }),
    'a waiting Alert',
  );
  await runDeliver();
  await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)');
  const rounds = (await messageKinds(id)).filter((m) => m.kind === 'alert' && m.to_address === anna.luca.email).map((m) => m.status);
  assert.deepEqual(rounds, ['sent', 'sent'], 'both Alert rounds to Luca went out');
});
