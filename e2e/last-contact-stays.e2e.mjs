import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:112 "The Adventure always keeps at least one contact. Removing the last one is refused."
// docs/spec.md:71 "At least one contact always remains."
test('removing the last contact of a live Adventure is refused, and the Alert still reaches every contact', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'East ridge', p_deadline: null, p_contact_ids: [],
    }),
    'remove every contact',
  );
  assert.equal(saved.refusal, 'no_contacts', 'removing the last contact is refused');
  const kept = must(await admin.from('adventure_contacts').select('contact_id').eq('adventure_id', id), 'contacts');
  assert.deepEqual(kept.map((c) => c.contact_id).sort(), [anna.luca.id, anna.sara.id].sort(), 'Luca and Sara stay on the Adventure');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
});
