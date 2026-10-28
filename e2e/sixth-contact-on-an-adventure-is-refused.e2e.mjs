import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must } from './stack.mjs';

// docs/spec.md § Emergency Contacts "Each Adventure uses one to five contacts from the list. Saving a sixth is refused."
test('an Adventure with a sixth contact is refused, and one with five is saved', async () => {
  const anna = await adventurer();
  const run = anna.luca.email.split('@')[0];
  const more = [];
  for (let n = 3; n <= 6; n += 1) more.push((await anna.contact({ name: `Contact ${n}`, email: `${run}-${n}@example.com` })).id);
  const save = async (contactIds) =>
    must(
      await anna.client.rpc('save_adventure', {
        p_id: null, p_destination: 'Grosser Mythen',
        p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_contact_ids: contactIds,
      }),
      'save_adventure',
    )[0];

  const six = await save([anna.luca.id, anna.sara.id, ...more]);
  assert.equal(six.refusal, 'too_many_contacts', 'saving six contacts is refused');
  assert.equal(six.adventure_id, null, 'no Adventure is saved');

  const five = await save([anna.luca.id, anna.sara.id, ...more.slice(0, 3)]);
  assert.equal(five.refusal, null, 'five contacts are saved');
  const { count } = await admin.from('adventure_contacts').select('contact_id', { count: 'exact', head: true }).eq('adventure_id', five.adventure_id);
  assert.equal(count, 5, 'the Adventure uses all five');
});
