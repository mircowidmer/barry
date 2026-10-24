import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:57 "Destination on the map ... The contacts are not told the point."
test('the Heads-up and the Alert carry the Last Position but never the destination point on the map', async () => {
  const anna = await adventurer();
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_contact_ids: [anna.luca.id, anna.sara.id],
      p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(), p_destination_point: { latitude: 47.1, longitude: 8.75 },
    }),
    'save_adventure',
  );
  const id = saved.adventure_id;
  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start_adventure'),
    null,
  );
  const point = /47\.1\b|8\.75/;
  const headsUp = await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  assert.doesNotMatch(headsUp.Text, point, 'the Heads-up email does not tell the point');
  assert.doesNotMatch((await waitForText(anna.sara.phone, 'Anna is going on an adventure alone')).body, point, 'the Heads-up text message does not tell the point');

  await missDeadline(id);
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /Last position at .+: 47\.03000, 8\.68000/, 'the Alert carries the Last Position');
  assert.doesNotMatch(alert.Text, point, 'the Alert email does not tell the point');
  assert.doesNotMatch((await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure')).body, point, 'the Alert text message does not tell the point');
});
