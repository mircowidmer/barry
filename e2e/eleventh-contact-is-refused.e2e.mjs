import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must } from './stack.mjs';

// docs/spec.md § Emergency Contacts "The list holds at most 10 contacts. A pick beyond that is refused until the Adventurer deletes one."
test('an eleventh contact is refused until the Adventurer deletes one', async () => {
  const anna = await adventurer();
  const run = anna.luca.email.split('@')[0];
  for (let n = 3; n <= 10; n += 1) await anna.contact({ name: `Contact ${n}`, email: `${run}-${n}@example.com` });
  const list = async () => must(await anna.client.from('emergency_contacts').select('id').is('removed_at', null), 'contacts').length;
  assert.equal(await list(), 10, 'Luca, Sara and eight more fill the list');

  const eleventh = { name: 'Mia', email: `${run}-mia@example.com` };
  const refused = await anna.client.from('emergency_contacts').insert(eleventh);
  assert.match(refused.error?.message ?? '', /barry:too_many_contacts/, 'the eleventh contact is refused');
  assert.equal(await list(), 10, 'the list still holds ten');

  must(await anna.client.from('emergency_contacts').update({ removed_at: new Date().toISOString() }).eq('id', anna.sara.id), 'delete Sara');
  must(await anna.client.from('emergency_contacts').insert(eleventh), 'Mia after a deletion');
  assert.equal(await list(), 10, 'after a deletion the new contact takes the free place');
});
