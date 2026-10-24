import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, assertClockRan, mailCount, messageKinds, must, sleep, textsTo } from './stack.mjs';

// docs/spec.md:60 "Planned | The Adventurer saves a new Adventure."
// docs/spec.md:70 "Planned. The Adventurer can edit or delete the Adventure. Barry sends nothing and watches nothing."
// docs/spec.md:66 "They can have any number of Planned Adventures."
// docs/spec.md:38 "Barry sends nothing to a person when the Adventurer adds them to the list."
test('a Planned Adventure can be edited and deleted, and Barry sends nothing and watches nothing until the Start', async () => {
  const anna = await adventurer();
  const save = async (id, destination, deadline) =>
    must(
      await anna.client.rpc('save_adventure', { p_id: id, p_destination: destination, p_deadline: deadline, p_contact_ids: [anna.luca.id, anna.sara.id] }),
      'save_adventure',
    )[0];
  const passed = new Date(Date.now() - 60_000).toISOString();
  const first = await save(null, 'Grosser Mythen', passed);
  const second = await save(null, 'Pilatus', new Date(Date.now() + 3 * 3600_000).toISOString());
  assert.equal(first.refusal, null);
  assert.equal(second.refusal, null, 'a second Planned Adventure is saved beside the first');

  const edited = await save(first.adventure_id, 'Kleiner Mythen', passed);
  assert.equal(edited.refusal, null, 'a Planned Adventure can be edited');
  const stored = must(await admin.from('adventures').select('stage, destination').eq('id', first.adventure_id).single(), 'adventure');
  assert.deepEqual(stored, { stage: 'planned', destination: 'Kleiner Mythen' });

  await sleep(90);
  await assertClockRan();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', first.adventure_id).single(), 'adventure');
  assert.equal(stage, 'planned', 'the clock leaves a Planned Adventure alone, even past its Deadline');
  assert.deepEqual(await messageKinds(first.adventure_id), [], 'Barry queued nothing for it');
  assert.equal(await mailCount(anna.luca.email, 'Anna'), 0, 'Luca got no email');
  assert.deepEqual(await textsTo(anna.sara.phone), [], 'Sara got no text message');

  assert.equal(must(await anna.client.rpc('delete_adventure', { p_id: first.adventure_id }), 'delete_adventure'), null, 'a Planned Adventure can be deleted');
  const left = must(await admin.from('adventures').select('id').eq('adventurer_id', anna.userId), 'adventures');
  assert.deepEqual(left, [{ id: second.adventure_id }], 'the deleted Adventure is gone and the other Planned one stays');
});
