import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, waitForMail } from './stack.mjs';

// docs/spec.md:41 "A contact that an Active, Overdue, or Alerted Adventure uses cannot be deleted from the list."
// docs/spec.md:42 "A contact that only Planned Adventures use can be deleted from the list. The contact leaves those Planned
// Adventures. If a Planned Adventure has no contact left, Start refuses until the Adventurer adds one."
// docs/spec.md:66 "An Adventurer has at most one Active, Overdue, or Alerted Adventure at a time."
test('a contact of the live Adventure cannot be deleted, one of a Planned Adventure can and leaves it, and only one Adventure runs at a time', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  const removedAt = new Date().toISOString();
  const { error } = await anna.client.from('emergency_contacts').update({ removed_at: removedAt }).eq('id', anna.luca.id);
  assert.match(error?.message ?? '', /contact_in_use/, 'Luca, a contact of the Adventure in progress, cannot be deleted from the list');
  const { removed_at } = must(await anna.client.from('emergency_contacts').select('removed_at').eq('id', anna.luca.id).single(), 'Luca');
  assert.equal(removed_at, null, 'Luca stays on the list');

  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  const [planned] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Pilatus', p_deadline: new Date(Date.now() + 3 * 3600_000).toISOString(), p_contact_ids: [mia.id],
    }),
    'save a Planned Adventure with Mia',
  );
  must(await anna.client.from('emergency_contacts').update({ removed_at: removedAt }).eq('id', mia.id), 'Mia, whom only a Planned Adventure uses, can be deleted');
  const contacts = must(await anna.client.from('adventure_contacts').select('contact_id').eq('adventure_id', planned.adventure_id), 'contacts');
  assert.deepEqual(contacts, [], 'Mia leaves the Planned Adventure');

  const start = async () =>
    must(await anna.client.rpc('start_adventure', { p_id: planned.adventure_id, p_time_zone: 'Europe/Zurich' }), 'start_adventure');
  assert.equal(await start(), 'no_contacts', 'Start refuses the Planned Adventure without a contact');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: planned.adventure_id, p_destination: 'Pilatus', p_deadline: new Date(Date.now() + 3 * 3600_000).toISOString(), p_contact_ids: [anna.sara.id],
    }),
    'add Sara',
  );
  assert.equal(await start(), 'another_adventure_in_progress', 'a second Adventure cannot start while one is in progress');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  assert.equal(await start(), null, 'once the Adventurer added a contact and checked in from the first, the Planned Adventure starts');
});
