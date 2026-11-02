import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, sleep, waitForMail } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/live-adventure.md § Driving it with the iOS Simulator "In the database, `checked_in_at` is
// the time of the hold and `ended_at` is the time the signal returned."
test('a Check-in that waited for signal keeps the time of the hold as checked_in_at, and ended_at is the time the signal returned', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  // The hold falls after the Start, which check_in never lets checked_in_at precede, and the signal returns a few seconds later.
  const heldAt = new Date();
  await sleep(5);
  const sentAt = Date.now();
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: heldAt.toISOString() }), 'check_in'), null);
  const arrivedAt = Date.now();

  const ended = must(await admin.from('adventures').select('stage, checked_in_at, ended_at').eq('id', id).single(), 'adventure');
  assert.equal(ended.stage, 'ended');
  assert.equal(new Date(ended.checked_in_at).getTime(), heldAt.getTime(), 'checked_in_at is the time of the hold');
  const endedAt = new Date(ended.ended_at).getTime();
  assert.ok(endedAt >= sentAt - 1000 && endedAt <= arrivedAt + 1000, `ended_at ${ended.ended_at} is the time the Check-in arrived, not the hold`);
});
