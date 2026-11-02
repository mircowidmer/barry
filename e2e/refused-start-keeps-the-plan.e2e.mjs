import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, must } from './stack.mjs';

// docs/spec.md § Adventures > Start "If Supabase refuses the Start, nothing of the sheet is saved: … a Planned Adventure keeps what was
// saved before."
test('a refused Start saves nothing of the sheet, and the Planned Adventure keeps what was saved before', async () => {
  const anna = await adventurer();
  await anna.start();
  const deadline = new Date(Date.now() + 3 * 3600_000).toISOString();
  const [planned] = must(
    await anna.client.rpc('save_adventure', { p_id: null, p_destination: 'Pilatus', p_deadline: deadline, p_contact_ids: [anna.luca.id] }),
    'save_adventure',
  );
  assert.equal(planned.refusal, null);

  const [started] = must(
    await anna.client.rpc('save_and_start_adventure', {
      p_id: planned.adventure_id, p_destination: 'Rigi', p_deadline: new Date(Date.now() + 4 * 3600_000).toISOString(),
      p_contact_ids: [anna.sara.id], p_time_zone: 'Europe/Zurich', p_latitude: 47.05, p_longitude: 8.48, p_accuracy_m: 10,
    }),
    'save_and_start_adventure',
  );
  assert.equal(started.refusal, 'another_adventure_in_progress', 'Supabase refuses the Start while another Adventure is in progress');

  const stored = must(await admin.from('adventures').select('stage, destination, deadline').eq('id', planned.adventure_id).single(), 'adventure');
  assert.equal(stored.stage, 'planned', 'the Adventure stays Planned');
  assert.equal(stored.destination, 'Pilatus', 'it keeps the destination saved before');
  assert.equal(new Date(stored.deadline).getTime(), new Date(deadline).getTime(), 'it keeps the Deadline saved before');
  const contacts = must(await admin.from('adventure_contacts').select('contact_id').eq('adventure_id', planned.adventure_id), 'contacts');
  assert.deepEqual(contacts, [{ contact_id: anna.luca.id }], 'it keeps Luca only, as saved before');
  assert.deepEqual(await messageKinds(planned.adventure_id), [], 'Barry queued nothing for it');
});
