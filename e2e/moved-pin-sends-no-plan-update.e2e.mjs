import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, must, waitForMail } from './stack.mjs';

// docs/spec.md § Adventures > Edit an Active or Overdue Adventure "Changing only the contacts, moving the Deadline, or moving the destination on the map sends no Plan Update."
test('moving the destination on the map sends no Plan Update', async () => {
  const anna = await adventurer();
  const plan = { p_destination: 'Grosser Mythen', p_contact_ids: [anna.luca.id, anna.sara.id] };
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, ...plan, p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_destination_point: { latitude: 47.1, longitude: 8.75 },
    }),
    'save_adventure',
  );
  const id = saved.adventure_id;
  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start_adventure'),
    null,
  );
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  const [moved] = must(
    await anna.client.rpc('save_adventure', { p_id: id, ...plan, p_deadline: null, p_destination_point: { latitude: 47.12, longitude: 8.76 } }),
    'save_adventure',
  );
  assert.equal(moved.refusal, null, 'the pin can be moved while the Adventure is Active');
  const point = must(await admin.from('adventures').select('destination_latitude, destination_longitude').eq('id', id).single(), 'adventure');
  assert.deepEqual(point, { destination_latitude: 47.12, destination_longitude: 8.76 }, 'the pin moved');
  assert.deepEqual((await messageKinds(id)).filter((m) => m.kind === 'plan_update'), [], 'no Plan Update was queued');
  assert.equal(await mailCount(anna.luca.email, 'Anna changed the plan'), 0, 'no Plan Update went out');
});
