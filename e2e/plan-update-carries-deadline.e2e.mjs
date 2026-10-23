import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, waitForMail, waitForText } from './stack.mjs';

const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// docs/spec.md:130 the Plan Update carries "Adventurer's name, the new Plan, Deadline, the contact's Trail Map link"
// CONTEXT.md:91 "carrying the new Plan, the Deadline and the contact's Trail Map link"
test('the Plan Update carries the Deadline, by email and by text message', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const { deadline } = must(await admin.from('adventures').select('deadline').eq('id', id).single(), 'adventure');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'West ridge', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const byDeadline = new RegExp(`If Anna has not checked in by ${literally(inZurich(new Date(deadline)))}, Barry will message you again`);
  const update = await waitForMail(anna.luca.email, 'Anna changed the plan for Grosser Mythen');
  assert.match(update.Text, byDeadline, 'the email Plan Update names the Deadline');
  const text = await waitForText(anna.sara.phone, 'Anna changed the plan');
  assert.match(text.body, byDeadline, 'the text message Plan Update names the Deadline');
});
