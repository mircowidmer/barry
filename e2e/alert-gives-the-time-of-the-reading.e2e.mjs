import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// The same parts as supabase/functions/deliver/messages.en.ts, so a wrong time zone or a named one fails the match.
const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};

// docs/spec.md § Messages > Message rules "The Last Position in an Alert gives the time of the reading and the coordinates."
test('the Last Position in an Alert gives the time of the reading and the coordinates', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  // record_trail takes readings up to two minutes ahead, so a reading 90 seconds ahead falls in a later
  // minute than the Start reading and is the Last Position.
  const takenAt = new Date(Date.now() + 90_000);
  assert.equal(
    must(await anna.client.rpc('record_trail', { p_id: id, p_readings: [{ taken_at: takenAt.toISOString(), latitude: 47.12345, longitude: 8.54321, accuracy_m: 7 }] }), 'record_trail'),
    null,
  );

  await missDeadline(id);
  const line = `Last position at ${inZurich(takenAt)}: 47.12345, 8.54321`;
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.ok(alert.Text.includes(line), `Luca’s Alert email says "${line}"`);
  const alertText = await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
  assert.ok(alertText.body.includes(line), `Sara’s Alert text message says "${line}"`);
});
