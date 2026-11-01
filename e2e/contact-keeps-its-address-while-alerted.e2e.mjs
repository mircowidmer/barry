import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, hourAfterAlert, mailCount, missDeadline, must, textsTo, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Emergency Contacts "Supabase refuses a changed address on a contact that an Active, Overdue or Alerted Adventure uses."
test('Supabase refuses a changed address on a contact that an Overdue or Alerted Adventure uses, so the next Alert reaches the old address', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const stage = async () => must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure').stage;
  const change = async (contact, fields) =>
    (await anna.client.from('emergency_contacts').update(fields).eq('id', contact.id)).error?.message ?? '';
  const strangerEmail = anna.luca.email.replace('luca-', 'stranger-');
  const strangerPhone = anna.sara.phone.replace(/^\+4179/, '+4177');

  await missDeadline(id, 4.5);
  tick();
  assert.equal(await stage(), 'overdue');
  assert.match(await change(anna.luca, { email: strangerEmail }), /contact_in_use/, 'Luca’s email address cannot change while the Adventure is Overdue');

  await missDeadline(id);
  tick();
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.equal(await stage(), 'alerted');
  assert.match(await change(anna.sara, { phone: strangerPhone }), /contact_in_use/, 'Sara’s phone number cannot change while the Adventure is Alerted');
  const listed = must(await anna.client.from('emergency_contacts').select('email, phone').in('id', [anna.luca.id, anna.sara.id]).order('name'), 'contacts');
  assert.deepEqual(listed, [{ email: anna.luca.email, phone: null }, { email: null, phone: anna.sara.phone }], 'Luca and Sara keep their addresses');

  await hourAfterAlert(id);
  await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)');
  await waitForText(anna.sara.phone, 'Anna has still not checked in from an adventure (alert 2 of 3)');
  assert.equal(await mailCount(strangerEmail, 'Anna'), 0, 'the stranger’s email address gets nothing');
  assert.deepEqual(await textsTo(strangerPhone), [], 'the stranger’s phone number gets nothing');
});
