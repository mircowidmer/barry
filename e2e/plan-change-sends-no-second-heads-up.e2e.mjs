import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, messageKinds, messagesOut, must, waitForMail, waitForText } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/live-adventure.md § Driving it with the iOS Simulator "Within 15 seconds `fixture.mjs state`
// lists a `plan_update` row per contact address, `plan_update | email | luca@example.com | sent` and `plan_update | sms | +41792222222 | sent`,
// and no new `heads_up`."
test('a Plan change sends a Plan Update to each contact address and no new Heads-up', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  await messagesOut(id);

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Pilatus Kulm', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const update = await waitForMail(anna.luca.email, 'Anna changed the plan for Pilatus Kulm');
  assert.match(update.Text, /Destination: Pilatus Kulm/);
  await waitForText(anna.sara.phone, 'Anna changed the plan');
  await messagesOut(id);

  const rows = (await messageKinds(id)).map((m) => [m.kind, m.to_address, m.status]).sort();
  assert.deepEqual(
    rows,
    [
      ['heads_up', anna.luca.email, 'sent'],
      ['heads_up', anna.sara.phone, 'sent'],
      ['plan_update', anna.luca.email, 'sent'],
      ['plan_update', anna.sara.phone, 'sent'],
    ].sort(),
    'one sent Plan Update per contact address, and no new Heads-up',
  );
  assert.equal(await mailCount(anna.luca.email, 'Anna is heading out'), 1, 'Luca got one Heads-up');
});
