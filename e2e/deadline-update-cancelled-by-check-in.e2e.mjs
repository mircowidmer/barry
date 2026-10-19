import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, messageKinds, must, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:95 "A Deadline Update still waiting at the Check-in ... is not sent."
test('a Deadline Update still waiting at the Check-in is not sent', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  const waiting = (await messageKinds(id)).filter((m) => m.kind === 'deadline_update');
  assert.deepEqual(waiting.map((m) => m.status), ['pending', 'pending'], 'a Deadline Update waits for each address');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  const afterwards = (await messageKinds(id)).filter((m) => m.kind === 'deadline_update');
  assert.deepEqual(afterwards.map((m) => m.status), ['cancelled', 'cancelled'], 'the waiting Deadline Updates are cancelled, not sent');
  assert.equal(await mailCount(anna.luca.email, 'Anna needs more time'), 0, 'Luca got no Deadline Update');
  assert.equal((await textsTo(anna.sara.phone)).some((m) => m.body.startsWith('Anna needs more time')), false, 'Sara got no Deadline Update');
  assert.deepEqual(must(await anna.client.from('delivery_failures').select('kind').eq('adventure_id', id), 'Delivery Failures'), [], 'and it is no Delivery Failure');
});
