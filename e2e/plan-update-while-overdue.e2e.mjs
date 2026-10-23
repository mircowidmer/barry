import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, waitForMail } from './stack.mjs';

// docs/spec.md:78 "Active and Overdue. The Adventurer can edit the Plan, add contacts, remove contacts, and move the Deadline later."
// docs/spec.md:116 "A change to the destination or route sends a Plan Update to each contact whose Heads-up already went out."
// docs/spec.md:115 "The Alert always carries the latest Plan."
test('a Plan change while Overdue sends a Plan Update, and the Alert that follows carries the new Plan', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id, 4.5);
  tick();
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'overdue', 'the clock marked the Adventure Overdue');

  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'West ridge', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  assert.equal(saved.refusal, null, 'the Plan can be edited while Overdue');
  const update = await waitForMail(anna.luca.email, 'Anna changed the plan for Grosser Mythen');
  assert.match(update.Text, /Route: West ridge/, 'the Plan Update carries the new route');

  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /Route: West ridge/, 'the Alert carries the latest Plan');
});
