import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Start "**Start** saves the sheet and starts the Adventure in one step."
// docs/spec.md § Adventures > Start "When Supabase confirms the Start, the Adventure becomes Active and Barry sends a Heads-up to each of its contacts."
test('Start saves the sheet and starts the Adventure in one step, and the Alert carries the position given with the Start', async () => {
  const anna = await adventurer();
  // The arguments the app's start sends: the sheet, the phone's time zone and the Last Position.
  const rows = must(
    await anna.client.rpc('save_and_start_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
      p_contact_ids: [anna.luca.id, anna.sara.id], p_time_zone: 'Europe/Zurich',
      p_latitude: 46.9876, p_longitude: 8.6543, p_position_taken_at: new Date().toISOString(), p_accuracy_m: 9,
    }),
    'save_and_start_adventure',
  );
  assert.equal(rows.length, 1, 'the command answers with one row');
  const [{ adventure_id: id, refusal }] = rows;
  assert.equal(refusal, null, 'Supabase confirms the Start');
  assert.ok(id, 'the command names the saved Adventure');

  const stored = must(await admin.from('adventures').select('stage, destination').eq('id', id).single(), 'adventure');
  assert.deepEqual(stored, { stage: 'active', destination: 'Grosser Mythen' }, 'the sheet is saved and the Adventure is Active');
  const contacts = must(await admin.from('adventure_contacts').select('contact_id').eq('adventure_id', id), 'contacts');
  assert.deepEqual(contacts.map((c) => c.contact_id).sort(), [anna.luca.id, anna.sara.id].sort(), 'both contacts are saved with it');

  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  await missDeadline(id);
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /Last position at .+: 46\.98760, 8\.65430/, 'the Alert carries the position recorded with the Start');
});
