import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:43 "A contact that an Active, Overdue, or Alerted Adventure uses cannot be deleted from the list."
test('a contact of an Overdue or Alerted Adventure cannot be deleted from the list, and still gets the All-clear', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const stage = async () => must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure').stage;
  const remove = async (contact) =>
    (await anna.client.from('emergency_contacts').update({ removed_at: new Date().toISOString() }).eq('id', contact.id)).error?.message ?? '';

  await missDeadline(id, 0.2);
  tick();
  assert.equal(await stage(), 'overdue');
  assert.match(await remove(anna.luca), /contact_in_use/, 'Luca cannot be deleted while the Adventure is Overdue');

  await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.equal(await stage(), 'alerted');
  assert.match(await remove(anna.sara), /contact_in_use/, 'Sara cannot be deleted while the Adventure is Alerted');

  const listed = must(await anna.client.from('emergency_contacts').select('id, removed_at').in('id', [anna.luca.id, anna.sara.id]), 'contacts');
  assert.deepEqual(listed.map((c) => c.removed_at), [null, null], 'Luca and Sara stay on the list');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');
});
