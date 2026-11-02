import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, assertClockRan, hourAfterAlert, mailCount, messageKinds, missDeadline, must, runDeliver, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Check-in "A Check-in ends the Adventure and sends an All-clear to every contact, whether it comes before the
// Deadline, while Overdue, or after the Alert."
// docs/adr/0001-server-owns-the-deadline.md: the worst case is an Alert followed by an All-clear. No Alert may follow the All-clear.
test('a Check-in after the first Alert sends the All-clear, and the second and third Alert never follow it', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  // An hour after the first Alert, when the second would have been due.
  await hourAfterAlert(id);
  await runDeliver();
  await assertClockRan();

  const alerts = (await messageKinds(id)).filter((m) => m.kind === 'alert');
  assert.deepEqual(
    alerts.map((m) => [m.to_address, m.status]).sort(),
    [[anna.luca.email, 'sent'], [anna.sara.phone, 'sent']].sort(),
    'one Alert went to each address and no second one is queued after the All-clear',
  );
  assert.equal(await mailCount(anna.luca.email, 'has still not checked in'), 0, 'Luca got no second Alert');
  assert.equal((await textsTo(anna.sara.phone)).filter((m) => m.body.includes('still not checked in')).length, 0, 'Sara got no second Alert');
  const [after] = must(await admin.from('adventures').select('stage').eq('id', id), 'adventure');
  assert.equal(after.stage, 'ended', 'the Adventure stays Ended');
});
