import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, assertClockRan, mailCount, messageKinds, missDeadline, must, sleep, textsTo, waitForMail } from './stack.mjs';

test('a Check-in before the Deadline means no Alert and no All-clear, even after the Deadline passes', async () => {
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
      ['heads_up', anna.sara.phone, 'sent'],
      ['heads_up', anna.luca.email, 'sent'],
    ].sort(),
    'Luca and Sara got the Heads-up and nothing else',
  );
  assert.equal((await textsTo(anna.sara.phone)).length, 1, 'Sara got the Heads-up text message and nothing else');
  assert.equal(await mailCount(anna.luca.email, 'has not checked in'), 0);
});
