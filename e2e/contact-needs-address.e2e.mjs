import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must } from './stack.mjs';

// docs/spec.md:36 "A contact needs at least one address that is filled in and switched on. Without one, it cannot be saved."
test('a contact without an address that is filled in cannot be saved', async () => {
  const anna = await adventurer();
  const list = async () => must(await anna.client.from('emergency_contacts').select('id'), 'contacts').length;

  const nameOnly = await anna.client.from('emergency_contacts').insert({ name: 'Mia' });
  assert.match(nameOnly.error?.message ?? '', /emergency_contacts_reachable/, 'a contact with a name only is refused');
  const emptyEmail = await anna.client.from('emergency_contacts').insert({ name: 'Mia', email: '' });
  assert.match(emptyEmail.error?.message ?? '', /emergency_contacts_email_check/, 'an empty email address is not an address');
  assert.equal(await list(), 2, 'the list still holds only Luca and Sara');
});
