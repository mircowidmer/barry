import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, must, waitForMail } from './stack.mjs';

// docs/spec.md:37 "Barry reaches a contact only on the addresses that are switched on. A switched-off address is kept, so
// switching it back on restores it."
test('a switched-off email address is kept, and once it is switched back on Barry reaches the contact there again', async () => {
  const anna = await adventurer();
  must(await anna.client.from('emergency_contacts').update({ phone: `+4179${String(randomInt(1e7)).padStart(7, '0')}` }).eq('id', anna.luca.id), 'give Luca a phone number too');
  must(await anna.client.from('emergency_contacts').update({ email_enabled: false }).eq('id', anna.luca.id), 'switch off Luca’s email address');
  const { email } = must(await anna.client.from('emergency_contacts').select('email').eq('id', anna.luca.id).single(), 'Luca');
  assert.equal(email, anna.luca.email, 'the switched-off address is kept');

  must(await anna.client.from('emergency_contacts').update({ email_enabled: true }).eq('id', anna.luca.id), 'switch it back on');
  await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
});
