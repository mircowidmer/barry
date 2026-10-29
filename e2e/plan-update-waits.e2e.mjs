import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, messageKinds, must, paceOver, runDeliver, sleep, waitForMail } from './stack.mjs';

const save = (anna, id, destination, contactIds) =>
  anna.client.rpc('save_adventure', { p_id: id, p_destination: destination, p_deadline: null, p_contact_ids: contactIds });

// docs/spec.md § Plan changes "A Plan Update waits until 15 minutes after the last Plan Update to the same address. Several changes
// before a Plan Update goes out send only one, with the latest Plan."
test('a second Plan change within 15 minutes waits, and the changes in between go out as one Plan Update with the latest Plan', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  must(await save(anna, id, 'Kleiner Mythen', [anna.luca.id, anna.sara.id]), 'first change');
  await waitForMail(anna.luca.email, 'Anna changed the plan for Kleiner Mythen');

  must(await save(anna, id, 'Haggenspitz', [anna.luca.id, anna.sara.id]), 'second change');
  must(await save(anna, id, 'Rotenflue', [anna.luca.id, anna.sara.id]), 'third change');
  await runDeliver();
  await sleep(5);
  assert.equal(await mailCount(anna.luca.email, 'Anna changed the plan for Rotenflue'), 0, 'the next Plan Update waits for the 15 minutes');
  const pending = (await messageKinds(id)).filter((m) => m.kind === 'plan_update' && m.status === 'pending');
  assert.equal(pending.length, 2, 'one Plan Update waits for each of Luca and Sara');

  await paceOver(id);
  await runDeliver();
  const update = await waitForMail(anna.luca.email, 'Anna changed the plan for Rotenflue');
  assert.match(update.Text, /Destination: Rotenflue/);
  assert.equal(await mailCount(anna.luca.email, 'Anna changed the plan for Haggenspitz'), 0, 'the change in between is never sent');
});
