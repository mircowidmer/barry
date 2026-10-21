import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:134 "Every channel the contact has": a contact with an email address and a phone number gets the All-clear
// by email and by text message.
test('the All-clear reaches a contact on both of their addresses', async () => {
  const anna = await adventurer();
  const phone = `+4179${String(randomInt(1e7)).padStart(7, '0')}`;
  must(await anna.client.from('emergency_contacts').update({ phone }).eq('id', anna.luca.id), 'give Luca a phone number too');
  const id = await anna.start();

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(phone, 'Anna checked in safely');
});
