import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, assertClockRan, mailCount, messageKinds, missDeadline, must, runDeliver, textsTo, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Move the Deadline "Moving the Deadline of an Overdue or Alerted Adventure makes it Active again."
// docs/spec.md § Messages > Message rules "After the third Alert for a Deadline, Barry sends nothing more for it." The Alerts for the old Deadline end
// with the move: a contact must not get "still not checked in" for a Deadline the Adventurer already moved.
test('a Deadline move after the first Alert makes the Adventure Active again, and the second and third Alert for the old Deadline never come', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');

  const later = new Date(Date.now() + 2 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null, 'an Alerted Adventure moves its Deadline');
  const [moved] = must(await admin.from('adventures').select('stage, alerts_sent, earlier_alerts').eq('id', id), 'adventure');
  assert.deepEqual(moved, { stage: 'active', alerts_sent: 0, earlier_alerts: 1 }, 'it is Active again and keeps the one Alert it had');

  // The clock runs again, as it would at the hour when the second Alert had been due.
  tick();
  await runDeliver();
  await assertClockRan();

  const alerts = (await messageKinds(id)).filter((m) => m.kind === 'alert');
  assert.deepEqual(
    alerts.map((m) => [m.to_address, m.status]).sort(),
    [[anna.luca.email, 'sent'], [anna.sara.phone, 'sent']].sort(),
    'one Alert went to each address and no second one is queued',
  );
  assert.equal(await mailCount(anna.luca.email, 'has still not checked in'), 0, 'Luca got no second Alert');
  assert.equal((await textsTo(anna.sara.phone)).filter((m) => m.body.includes('still not checked in')).length, 0, 'Sara got no second Alert');
  const [after] = must(await admin.from('adventures').select('stage').eq('id', id), 'adventure');
  assert.equal(after.stage, 'active', 'the Adventure stays Active until the moved Deadline passes');
});
