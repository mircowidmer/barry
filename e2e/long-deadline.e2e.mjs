import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, waitForMail } from './stack.mjs';

const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// docs/spec.md § Adventures > Fields "Deadline | Yes | An absolute moment in time. Must be in the future at Start. No maximum length."
test('a Deadline more than a year ahead starts the Adventure, and the Heads-up names it', async () => {
  const anna = await adventurer();
  const deadline = new Date(Date.now() + 400 * 24 * 3600_000);
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_deadline: deadline.toISOString(), p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  assert.equal(saved.refusal, null, 'the Deadline has no maximum length');
  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: saved.adventure_id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start_adventure'),
    null,
    'the Adventure starts',
  );
  const headsUp = await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  assert.match(headsUp.Text, new RegExp(`If Anna has not checked in by ${literally(inZurich(deadline))}, Barry will message you again`), 'the Heads-up names the Deadline');
});
