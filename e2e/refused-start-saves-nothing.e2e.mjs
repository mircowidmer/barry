import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, must, runDeliver, sleep, waitForMail } from './stack.mjs';

// docs/spec.md § Adventures > Start "If Supabase refuses the Start, nothing of the sheet is saved: a new Adventure is not listed on the
// Adventure tab"
test('a refused Start of a new Adventure saves nothing, so it is not listed on the Adventure tab and no contact hears of it', async () => {
  const anna = await adventurer();
  await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const listed = async () => must(await anna.client.from('adventures').select('id, destination'), 'adventures');
  const before = await listed();

  const [result] = must(
    await anna.client.rpc('save_and_start_adventure', {
      p_id: null, p_destination: 'Rigi', p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
      p_contact_ids: [anna.luca.id, anna.sara.id], p_time_zone: 'Europe/Zurich', p_latitude: 47.05, p_longitude: 8.48, p_accuracy_m: 10,
    }),
    'save_and_start_adventure',
  );
  assert.equal(result.refusal, 'another_adventure_in_progress', 'Supabase refuses the Start while another Adventure is in progress');
  assert.equal(result.adventure_id, null, 'the refusal names no Adventure');

  const after = await listed();
  assert.equal(after.length, before.length, 'Anna has as many Adventures as before');
  assert.ok(!after.some((a) => a.destination === 'Rigi'), 'the refused Adventure is not listed');

  await runDeliver();
  await sleep(5);
  assert.equal(await mailCount(anna.luca.email, 'Anna is heading out to Rigi'), 0, 'Luca gets no Heads-up for the refused Adventure');
});
