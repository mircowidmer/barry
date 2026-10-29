import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, must, sleep, waitForMail } from './stack.mjs';

// docs/spec.md § Emergency Contacts "Supabase refuses a changed address on a contact that an Active, Overdue or Alerted Adventure uses."
test('a contact of the live Adventure keeps its address, and an update that leaves the address as it is goes through', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  const stranger = anna.luca.email.replace('luca-', 'stranger-');
  const { error } = await anna.client.from('emergency_contacts').update({ email: stranger }).eq('id', anna.luca.id);
  assert.match(error?.message ?? '', /contact_in_use/, 'Luca\'s email address cannot be typed over');
  const { email } = must(await anna.client.from('emergency_contacts').select('email').eq('id', anna.luca.id).single(), 'Luca');
  assert.equal(email, anna.luca.email, 'Luca keeps his address');

  must(
    await anna.client.from('emergency_contacts').update({ name: 'Luca B.', email: anna.luca.email }).eq('id', anna.luca.id),
    'an update that sends the same address, as the app does',
  );

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  must(await anna.client.from('emergency_contacts').update({ email: stranger }).eq('id', anna.luca.id), 'once Ended, the address can change');
  await sleep(5);
  assert.equal(await mailCount(stranger, 'Anna'), 0, 'the new address hears nothing from the Ended Adventure');
});
