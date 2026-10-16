import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, assertClockRan, mailCount, messageKinds, missDeadline, must, sleep, textsTo, waitForMail } from './stack.mjs';

test('a Check-in before the Deadline sends the All-clear and no Alert, even after the Deadline passes', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await missDeadline(id);
  await sleep(90);
  await assertClockRan();

  assert.deepEqual(
    (await messageKinds(id)).map((m) => [m.kind, m.to_address, m.status]).sort(),
    [
      ['all_clear', anna.sara.phone, 'sent'],
      ['all_clear', anna.luca.email, 'sent'],
      ['heads_up', anna.sara.phone, 'sent'],
      ['heads_up', anna.luca.email, 'sent'],
    ].sort(),
    'Luca and Sara got the Heads-up and the All-clear, and no Alert',
  );
  assert.equal((await textsTo(anna.sara.phone)).length, 2, 'Sara got the Heads-up and the All-clear text messages');
  assert.equal(await mailCount(anna.luca.email, 'Anna is back safe'), 1, 'Luca got the All-clear email');
  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0);
});
