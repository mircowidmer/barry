import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, must, paceOver, runDeliver, sleep, waitForMail } from './stack.mjs';

const PACE_MS = 15 * 60_000;

const move = async (anna, id, at) =>
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: at.toISOString() }), 'move_deadline'), null);

const deadlineUpdates = async (id, to, status) =>
  must(
    await admin
      .from('messages')
      .select('next_attempt_at, sent_at, previous_deadline')
      .eq('adventure_id', id)
      .eq('kind', 'deadline_update')
      .eq('to_address', to)
      .eq('status', status)
      .order('created_at'),
    `${status} Deadline Updates to ${to}`,
  );

const waitForMailCount = async (to, subject, count) => {
  for (let i = 0; i < 75; i++) {
    if ((await mailCount(to, subject)) >= count) return;
    await sleep(2);
  }
  throw new Error(`no ${count} emails "${subject}" to ${to} within 150 seconds`);
};

// docs/spec.md § Adventures > Move the Deadline "The Deadline Update waits 3 minutes, and at least 15 minutes after the last Deadline
// Update to the same address. Another move in that time replaces it, so quick moves in a row send one Deadline Update, from the time
// the contact knew to the latest one."
test('a Deadline move within 15 minutes of the last Deadline Update waits for the pace, and the moves in that time become one Deadline Update from the Deadline the contact knew', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const { deadline } = must(await admin.from('adventures').select('deadline').eq('id', id).single(), 'adventure');
  const known = new Date(deadline);
  const told = new Date(known.getTime() + 3600_000);

  await move(anna, id, told);
  await paceOver(id);
  await waitForMail(anna.luca.email, 'Anna needs more time for Grosser Mythen');
  const [{ sent_at: firstSentAt }] = await deadlineUpdates(id, anna.luca.email, 'sent');

  await move(anna, id, new Date(known.getTime() + 2 * 3600_000));
  const [waiting] = await deadlineUpdates(id, anna.luca.email, 'pending');
  assert.ok(
    new Date(waiting.next_attempt_at).getTime() >= new Date(firstSentAt).getTime() + PACE_MS - 1000,
    'the next Deadline Update to Luca waits 15 minutes after the last one went out',
  );
  await runDeliver();
  await sleep(5);
  assert.equal(await mailCount(anna.luca.email, 'Anna needs more time'), 1, 'the second Deadline Update waits for the 15 minutes');

  await move(anna, id, new Date(known.getTime() + 3 * 3600_000));
  await paceOver(id);
  await runDeliver();
  await waitForMailCount(anna.luca.email, 'Anna needs more time', 2);
  const sent = await deadlineUpdates(id, anna.luca.email, 'sent');
  assert.equal(sent.length, 2, 'the two moves in the wait became one Deadline Update');
  assert.equal(new Date(sent[1].previous_deadline).getTime(), told.getTime(), 'it runs from the Deadline the contact knew, the one the first Deadline Update named');
});
