import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// The same parts as supabase/functions/deliver/messages.en.ts, so the All-clear's time can be matched exactly.
const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};

// docs/spec.md § Adventures > Check-in "If the phone has no signal, the app keeps the Check-in and sends it when the signal returns. If the
// Alert goes out first, the All-clear follows it."
// docs/adr/0001-server-owns-the-deadline.md:8 "The worst case is an Alert followed by an All-clear, which is safe."
test('a Check-in that waited for signal while the Alert went out ends the Adventure, and the All-clear follows the Alert', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const heldAt = new Date();

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: heldAt.toISOString() }), 'check_in'), null);
  const allClear = await waitForMail(anna.luca.email, 'Anna is back safe');
  assert.match(allClear.Text, new RegExp(`Anna checked in safely at ${inZurich(heldAt)}\\.`), 'the All-clear gives the time the Adventurer checked in');
  await waitForText(anna.sara.phone, `Anna checked in safely at ${inZurich(heldAt)}.`);

  const after = must(await admin.from('adventures').select('stage, checked_in_at').eq('id', id).single(), 'adventure');
  assert.equal(after.stage, 'ended', 'the late Check-in ends the Alerted Adventure');
  assert.equal(new Date(after.checked_in_at).getTime(), heldAt.getTime(), 'the Check-in keeps the time it was made, not the time it arrived');
});
