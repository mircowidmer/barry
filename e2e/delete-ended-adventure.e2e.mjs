import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, runDeliver, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Stages "Deleting an Ended Adventure removes its Plan, its readings and its messages, and its Trail Map links stop
// working. Barry refuses while a message for it is still being sent, such as the All-clear after an Alert."
test('deleting an Ended Adventure is refused while its All-clear is still being sent, and afterwards removes its Plan, readings, messages and links', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const reading = { taken_at: new Date().toISOString(), latitude: 47.04, longitude: 8.69, accuracy_m: 8 };
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [reading] }), 'record_trail'), null);

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
  assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: id }), 'delete_adventure'), 'messages_pending', 'Barry refuses while the All-clear is still being sent');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  must(await admin.from('messages').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('id', held.id), 'release the lease');
  await runDeliver();
  await waitForMail(anna.luca.email, 'Anna is back safe');
  assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: id }), 'delete_adventure'), null, 'the Ended Adventure is deleted once the All-clear is out');

  const gone = async (table) => must(await admin.from(table).select('*').eq(table === 'adventures' ? 'id' : 'adventure_id', id), table);
  assert.deepEqual(await gone('adventures'), [], 'its Plan is gone');
  assert.deepEqual(await gone('position_readings'), [], 'its readings are gone');
  assert.deepEqual(await gone('messages'), [], 'its messages are gone');
  assert.equal(await trailMap(token), null, 'its Trail Map links stop working');
});
