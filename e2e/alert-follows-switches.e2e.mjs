import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, mailCount, missDeadline, must, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Emergency Contacts "Barry reaches a contact only on the addresses that are switched on."
test('an address the Adventurer switches off during the Adventure gets no Alert, and the contact is reached on the other', async () => {
  const anna = await adventurer();
  const phone = `+4179${String(randomInt(1e7)).padStart(7, '0')}`;
  must(await anna.client.from('emergency_contacts').update({ phone }).eq('id', anna.luca.id), 'give Luca a phone number too');
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(phone, 'Anna is going on an adventure alone');

  must(await anna.client.from('emergency_contacts').update({ email_enabled: false }).eq('id', anna.luca.id), 'switch off Luca’s email address');
  await missDeadline(id);

  await waitForText(phone, 'Anna has not checked in from an adventure');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
  assert.equal(await mailCount(anna.luca.email, 'Anna has not checked in'), 0, 'Luca’s switched-off email address got no Alert');
  assert.equal((await textsTo(phone)).length, 2, 'Luca got the Heads-up and the Alert on his phone number');
});
