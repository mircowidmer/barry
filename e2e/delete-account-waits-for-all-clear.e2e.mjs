import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, runDeliver, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:17 "An account cannot be deleted ... while a message such as an All-clear is still being sent."
// docs/spec.md:16 "Deleting removes the Profile, the Emergency Contacts, every Adventure with its Trail and its messages, and every Trail Map link."
// docs/spec.md:172 "The Trail is deleted with the Adventurer's account."
test('deleting the account waits for an All-clear still on its way, then removes the Profile, the contacts, the Adventure and its Trail', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  // Luca's All-clear is on its way: a deliver run has claimed it and is taking long, so the Check-in
  // leaves the row alone and nothing sends it until the lease below is released.
  const [held] = must(
    await admin
      .from('messages')
      .insert({
        adventure_id: id, kind: 'all_clear', channel: 'email', to_address: anna.luca.email, contact_id: anna.luca.id,
        status: 'sending', attempts: 1, lease_until: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .select('id'),
    'an All-clear still being sent',
  );
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  assert.equal(must(await anna.client.rpc('delete_account'), 'delete_account'), 'messages_pending', 'the account is not deleted while the All-clear is still being sent');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  must(await admin.from('messages').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('id', held.id), 'release the lease');
  await runDeliver();
  await waitForMail(anna.luca.email, 'Anna is back safe');
  assert.equal(must(await anna.client.rpc('delete_account'), 'delete_account'), null, 'the account is deleted once the All-clear is out');

  const gone = async (table, column, value) => must(await admin.from(table).select('*').eq(column, value), table);
  assert.deepEqual(await gone('adventurer_profiles', 'id', anna.userId), [], 'the Profile is gone');
  assert.deepEqual(await gone('emergency_contacts', 'adventurer_id', anna.userId), [], 'the Emergency Contacts are gone');
  assert.deepEqual(await gone('adventures', 'adventurer_id', anna.userId), [], 'every Adventure is gone');
  assert.deepEqual(await gone('position_readings', 'adventure_id', id), [], 'its Trail is gone');
  assert.deepEqual(await gone('messages', 'adventure_id', id), [], 'its messages are gone');
  assert.equal(await trailMap(token), null, 'the Trail Map link stops working');
});
