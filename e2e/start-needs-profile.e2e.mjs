import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, missDeadline, must, waitForMail } from './stack.mjs';

// docs/spec.md:31 "The name must be filled in before the Adventurer starts their first Adventure. Only the
// Alert carries the full Profile, and it leaves the phone line out when there is no phone number."
test('Start refuses until the Profile holds the name, and an Alert without a phone number leaves the phone line out', async () => {
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

  assert.equal(await start(), 'profile_incomplete', 'Start refuses without the name');
  assert.deepEqual(await messageKinds(saved.adventure_id), [], 'no Heads-up was queued');

  must(await anna.client.from('adventurer_profiles').insert({ id: anna.userId, name: 'Anna' }), 'fill in the name alone');
  assert.equal(await start(), null, 'with the name alone, Start is accepted');
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(saved.adventure_id);
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /Destination: Grosser Mythen/, 'the Alert carries the Plan');
  assert.doesNotMatch(alert.Text, /Anna's phone/, 'the Alert has no phone line without a phone number');
});
