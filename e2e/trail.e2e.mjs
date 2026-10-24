import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, trailMap, trailToken, waitForMail } from './stack.mjs';

test("the Trail reaches each contact's Trail Map, and a removed contact's link stops working", async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const token = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);

  const at = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();
  const readings = [
    { taken_at: at(1), latitude: 47.04, longitude: 8.69, accuracy_m: 8 },
    { taken_at: at(61), latitude: 47.05, longitude: 8.7, accuracy_m: 8 },
    { taken_at: at(111), latitude: 47.06, longitude: 8.71, accuracy_m: 8 },
  ];
  assert.equal(must(await anna.client.rpc('record_trail', { p_id: id, p_readings: readings }), 'record_trail'), null);

  const map = await trailMap(token);
  assert.equal(map.trail.length, 4, 'the Start reading and three Trail readings');
  assert.equal(map.last_known_position.latitude, 47.06);
  assert.deepEqual((await trailMap(token, readings[1].taken_at)).trail.map(([latitude]) => latitude), [47.06], 'asking with a time returns only newer readings');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', 
      p_deadline: null, p_contact_ids: [anna.sara.id],
    }),
    'save_adventure',
  );
  assert.equal(await trailMap(token), null, "the removed contact's link stops working");
});
