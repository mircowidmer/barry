import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, messageKinds, must, paceOver, runDeliver, sleep, textsTo, waitForMail, waitForText } from './stack.mjs';

const save = (anna, id, destination, contactIds) =>
  anna.client.rpc('save_adventure', { p_id: id, p_destination: destination, p_deadline: null, p_contact_ids: contactIds });

// docs/spec.md § Adventures > Edit an Active or Overdue Adventure "A contact removed from the Adventure gets no further messages, and their
// Trail Map link stops working."
test('a Plan Update still waiting for the pace is never sent to a contact removed from the Adventure', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  must(await save(anna, id, 'Kleiner Mythen', [anna.luca.id, anna.sara.id]), 'first change');
  await waitForMail(anna.luca.email, 'Anna changed the plan for Kleiner Mythen');
  await waitForText(anna.sara.phone, 'Anna changed the plan');

  must(await save(anna, id, 'Haggenspitz', [anna.luca.id, anna.sara.id]), 'second change, which waits for the pace');
  must(await save(anna, id, 'Haggenspitz', [anna.luca.id]), 'remove Sara');

  await paceOver(id);
  await runDeliver();
  await waitForMail(anna.luca.email, 'Anna changed the plan for Haggenspitz');
  await sleep(5);
  await runDeliver();

  assert.equal((await textsTo(anna.sara.phone)).length, 2, 'Sara got the Heads-up and the first Plan Update, and nothing after she was removed');
  const rows = (await messageKinds(id)).filter((m) => m.to_address === anna.sara.phone);
  assert.equal(rows.some((m) => m.status === 'pending' || m.status === 'sending'), false, 'nothing for Sara is left waiting');
});
