import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, missDeadline, must, textsTo, tick, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:78 "Active and Overdue. The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later."
// docs/spec.md:120 "A contact removed from the Adventure gets no further messages, and their Trail Map link stops working."
test('a contact removed from an Overdue Adventure gets no Alert, and their Trail Map link stops working', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const saraToken = trailToken((await waitForText(anna.sara.phone, 'Anna is going on an adventure alone')).body);

  await missDeadline(id, 4.5);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue', 'the clock marked the Adventure Overdue');

  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_deadline: null, p_contact_ids: [anna.luca.id],
    }),
    'save_adventure',
  );
  assert.equal(saved.refusal, null, 'a contact can be removed while Overdue');
  assert.equal(await trailMap(saraToken), null, "the removed contact's link stops working");

  await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.equal((await textsTo(anna.sara.phone)).length, 1, 'Sara got the Heads-up and nothing more');
  assert.ok(!(await messageKinds(id)).some((m) => m.kind === 'alert' && m.to_address === anna.sara.phone), 'no Alert was queued for Sara');
});
