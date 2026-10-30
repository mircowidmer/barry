import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, messagesOut, must } from './stack.mjs';

// docs/spec.md § Adventures > Start "An Adventurer can start at most 5 Adventures in 24 hours. A sixth Start is refused, and deleting an Adventure does not give a Start back."
test('a sixth Start in 24 hours is refused, even after the earlier Adventures are deleted', async () => {
  const anna = await adventurer();
  const started = [];
  for (let n = 1; n <= 5; n += 1) {
    const id = await anna.start();
    assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
    started.push(id);
  }
  // An Ended Adventure can be deleted once its Heads-ups are out.
  for (const id of started) {
    await messagesOut(id);
    assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: id }), 'delete_adventure'), null, 'the Ended Adventure is deleted');
  }

  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Rigi',
      p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const refusal = must(
    await anna.client.rpc('start_adventure', {
      p_id: saved.adventure_id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12,
    }),
    'start_adventure',
  );
  assert.equal(refusal, 'too_many_starts', 'the sixth Start is refused');
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', saved.adventure_id).single(), 'adventure');
  assert.equal(stage, 'planned', 'the Adventure stays Planned');
  assert.deepEqual(await messageKinds(saved.adventure_id), [], 'no Heads-up was queued');
});
