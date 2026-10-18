import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

test('a missed Deadline alerts every contact, and the Check-in sends the All-clear', async () => {
  const anna = await adventurer();
  const id = await anna.start();

  const headsUp = await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const token = trailToken(headsUp.Text);
  assert.ok(token, 'the Heads-up email carries a Trail Map link');
  const headsUpText = await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  assert.ok(trailToken(headsUpText.body), 'the Heads-up text message carries a Trail Map link');
  const underway = await trailMap(token);
  assert.equal(underway.status, 'underway');
  assert.equal('deadline' in underway, false, 'the Trail Map never shows the Deadline');

  await missDeadline(id);
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /Last Known Position at .+: 47\.03000, 8\.68000/);
  assert.match(alert.Text, /Car: red Subaru, SZ 12345/);
  assert.equal(trailToken(alert.Text), token, 'the Alert carries the same Trail Map link');
  assert.match(alert.Text, /Anna's phone: \+41790000001/);
  const alertText = await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
  assert.match(alertText.body, /Anna's phone: \+41790000001/);
  assert.equal((await trailMap(token)).status, 'alerted');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  const allClear = await waitForMail(anna.luca.email, 'Anna is back safe');
  assert.match(allClear.Text, /Anna checked in safely at/);
  assert.equal(trailToken(allClear.Text), token, 'the All-clear carries the same Trail Map link');
  await waitForText(anna.sara.phone, 'Anna checked in safely');
  const checkedIn = await trailMap(token);
  assert.equal(checkedIn.status, 'checked_in');
  assert.ok(checkedIn.trail?.length > 0, 'the Trail Map keeps the Trail after the Check-in');
  assert.equal(checkedIn.last_known_position?.latitude, 47.03, 'the Trail Map keeps the Last Known Position after the Check-in');
  assert.deepEqual(must(await anna.client.from('delivery_failures').select('kind').eq('adventure_id', id), 'Delivery Failures'), []);
});
