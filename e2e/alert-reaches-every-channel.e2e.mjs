import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:133 "Every channel the contact has": a contact with an email address and a phone number gets the Alert
// by email and by text message.
test('the Alert reaches a contact on both of their addresses', async () => {
  const anna = await adventurer();
  const phone = `+4179${String(randomInt(1e7)).padStart(7, '0')}`;
  must(await anna.client.from('emergency_contacts').update({ phone }).eq('id', anna.luca.id), 'give Luca a phone number too');
  const id = await anna.start();

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(phone, 'Anna has not checked in from an adventure');
});
