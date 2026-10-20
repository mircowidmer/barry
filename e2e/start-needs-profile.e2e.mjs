import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, must, waitForMail } from './stack.mjs';

// docs/spec.md:29 "The name and the phone number must be filled in before the Adventurer starts their first Adventure."
test('Start refuses until the Profile holds the name and the phone number', async () => {
  const anna = await adventurer();
  must(await admin.from('adventurer_profiles').delete().eq('id', anna.userId), 'an account without a Profile, as before its first save');
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_route: 'East ridge',
      p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const start = async () =>
    must(await anna.client.rpc('start_adventure', { p_id: saved.adventure_id, p_time_zone: 'Europe/Zurich' }), 'start_adventure');

  assert.equal(await start(), 'profile_incomplete', 'Start refuses without the name and the phone number');
  assert.deepEqual(await messageKinds(saved.adventure_id), [], 'no Heads-up was queued');

  must(await anna.client.from('adventurer_profiles').insert({ id: anna.userId, name: 'Anna', phone: '+41790000001' }), 'fill in the Profile');
  assert.equal(await start(), null, 'with the name and the phone number, Start is accepted');
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
});
