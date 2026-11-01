import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, paceOver, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Fields "Destination on the map ... The contacts are not told the point."
test('the contacts are not told the point: the Plan Update, the Deadline Update and the All-clear never carry it', async () => {
  const anna = await adventurer();
  const destinationPoint = { latitude: 47.1, longitude: 8.75 };
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_contact_ids: [anna.luca.id, anna.sara.id],
      p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_destination_point: destinationPoint,
    }),
    'save_adventure',
  );
  const id = saved.adventure_id;
  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start_adventure'),
    null,
  );
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id], p_destination_point: destinationPoint,
    }),
    'save_adventure',
  );
  await paceOver(id);
  const planUpdate = await waitForMail(anna.luca.email, 'Anna changed the plan for Kleiner Mythen');
  const planUpdateText = await waitForText(anna.sara.phone, 'Anna changed the plan');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  await paceOver(id);
  const deadlineUpdate = await waitForMail(anna.luca.email, 'Anna needs more time for Kleiner Mythen');
  const deadlineUpdateText = await waitForText(anna.sara.phone, 'Anna needs more time');

  const kept = must(await admin.from('adventures').select('destination_latitude, destination_longitude').eq('id', id).single(), 'adventure');
  assert.deepEqual(kept, { destination_latitude: 47.1, destination_longitude: 8.75 }, 'the Plan still has the point when the updates go out');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  const allClear = await waitForMail(anna.luca.email, 'Anna is back safe');
  const allClearText = await waitForText(anna.sara.phone, 'Anna checked in safely');

  const point = /47\.1\b|47\.10|8\.75/;
  for (const [what, body] of [
    ['the Plan Update email', planUpdate.Text],
    ['the Plan Update text message', planUpdateText.body],
    ['the Deadline Update email', deadlineUpdate.Text],
    ['the Deadline Update text message', deadlineUpdateText.body],
    ['the All-clear email', allClear.Text],
    ['the All-clear text message', allClearText.body],
  ]) {
    assert.doesNotMatch(body, point, `${what} does not tell the point`);
  }
});
