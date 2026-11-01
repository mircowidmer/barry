import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, missDeadline, must, tick, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Adventures > Stages "An Adventurer has at most one Active, Overdue, or Alerted Adventure at a time."
test('an Adventurer has at most one Active, Overdue, or Alerted Adventure at a time, so a Planned one cannot start while the first is Overdue or Alerted', async () => {
  const anna = await adventurer();
  const [planned] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Pilatus', p_deadline: new Date(Date.now() + 3 * 3600_000).toISOString(),
      p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save a Planned Adventure',
  );
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const stage = async (adventureId) => must(await admin.from('adventures').select('stage').eq('id', adventureId).single(), 'adventure').stage;
  const start = async () =>
    must(await anna.client.rpc('start_adventure', { p_id: planned.adventure_id, p_time_zone: 'Europe/Zurich' }), 'start_adventure');

  await missDeadline(id, 4.5);
  tick();
  assert.equal(await stage(id), 'overdue');
  assert.equal(await start(), 'another_adventure_in_progress', 'the Planned Adventure cannot start while the first is Overdue');

  await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.equal(await stage(id), 'alerted');
  assert.equal(await start(), 'another_adventure_in_progress', 'the Planned Adventure cannot start while the first is Alerted');
  assert.equal(await stage(planned.adventure_id), 'planned', 'the Planned Adventure stays Planned');
  assert.deepEqual(await messageKinds(planned.adventure_id), [], 'the Planned Adventure sends nothing');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  assert.equal(await start(), null, 'once the Adventurer checked in, the Planned Adventure starts');
  assert.equal(await stage(planned.adventure_id), 'active');
});
