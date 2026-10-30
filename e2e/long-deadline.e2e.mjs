import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must } from './stack.mjs';

const inDays = (days) => new Date(Date.now() + days * 24 * 3600_000).toISOString();

// docs/spec.md § Adventures > Fields "Deadline | Yes | An absolute moment in time. Must be in the future at Start. At most a year ahead when saved or moved."
test('a Deadline more than a year ahead is refused when saved and when moved, and one within the year goes through', async () => {
  const anna = await adventurer();
  const save = (deadline) =>
    anna.client.rpc('save_adventure', { p_id: null, p_destination: 'Grosser Mythen', p_deadline: deadline, p_contact_ids: [anna.luca.id] });

  const tooFar = await save(inDays(400));
  assert.equal(tooFar.error?.message, 'barry:deadline_too_far', 'a Plan with a Deadline 400 days ahead is refused');

  const [saved] = must(await save(inDays(300)), 'save_adventure');
  assert.equal(saved.refusal, null, 'a Plan with a Deadline 300 days ahead is saved');

  const id = await anna.start();
  const moved = await anna.client.rpc('move_deadline', { p_id: id, p_deadline: inDays(400) });
  assert.equal(moved.error?.message, 'barry:deadline_too_far', 'a Deadline cannot be moved 400 days ahead');
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: inDays(300) }), 'move_deadline'), null,
    'a Deadline can be moved 300 days ahead');
});
