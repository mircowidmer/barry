import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must } from './stack.mjs';

// docs/spec.md § Adventurer Profile "The name takes up to 100 characters, the car make and colour 50 each, the number plate 20 and the medical notes 500."
// docs/spec.md § Adventures > Fields "Destination | Yes | Part of the Plan. Up to 200 characters."
test('the Profile and the destination take their text up to the limit and refuse a longer one', async () => {
  const anna = await adventurer();
  const profile = (fields) => anna.client.from('adventurer_profiles').update(fields).eq('id', anna.userId).select('id');
  const limits = { name: 100, car_make: 50, car_colour: 50, car_plate: 20, medical_notes: 500 };
  for (const [field, limit] of Object.entries(limits)) {
    must(await profile({ [field]: 'x'.repeat(limit) }), `${field} at ${limit}`);
    const longer = await profile({ [field]: 'x'.repeat(limit + 1) });
    assert.equal(longer.error?.code, '23514', `${field} longer than ${limit} characters is refused`);
  }

  const save = (destination) =>
    anna.client.rpc('save_adventure', {
      p_id: null, p_destination: destination,
      p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_contact_ids: [anna.luca.id],
    });
  const [saved] = must(await save('x'.repeat(200)), 'a destination of 200 characters');
  assert.equal(saved.refusal, null, 'a destination of 200 characters is saved');
  assert.equal((await save('x'.repeat(201))).error?.code, '23514', 'a destination longer than 200 characters is refused');
});
