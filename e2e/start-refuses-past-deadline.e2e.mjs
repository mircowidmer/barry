import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, must } from './stack.mjs';

// docs/spec.md:52 "Deadline | Yes | An absolute moment in time. Must be in the future at Start."
test('Start refuses a Deadline that has passed, and Barry queues nothing', async () => {
  const anna = await adventurer();
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', 
      p_deadline: new Date(Date.now() - 60_000).toISOString(), p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const refusal = must(
    await anna.client.rpc('start_adventure', {
      p_id: saved.adventure_id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12,
    }),
    'start_adventure',
  );
  assert.equal(refusal, 'deadline_not_in_future', 'Start refuses the passed Deadline');

  const { stage } = must(await admin.from('adventures').select('stage').eq('id', saved.adventure_id).single(), 'adventure');
  assert.equal(stage, 'planned', 'the Adventure stays Planned');
  assert.deepEqual(await messageKinds(saved.adventure_id), [], 'no Heads-up was queued');
});
