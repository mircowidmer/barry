import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

// docs/spec.md:179 "The page shows the Adventurer's name, the Plan, the Trail as a line on an OpenStreetMap map, and the
// Last Position with the time of the reading."
test("the Trail Map shows the Adventurer's name and the latest Plan", async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  const map = await trailMap(token);
  assert.equal(map.adventurer_name, 'Anna', "the page shows the Adventurer's name");
  assert.deepEqual(map.plan, { destination: 'Grosser Mythen', route: 'East ridge' }, 'the page shows the Plan');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'West ridge', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  assert.deepEqual((await trailMap(token)).plan, { destination: 'Grosser Mythen', route: 'West ridge' }, 'the page shows the changed Plan');
});
