import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// The same parts as supabase/functions/deliver/messages.en.ts, so a wrong time zone or a named one fails the match.
const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};

// docs/spec.md:106 "The Alert always carries the latest Plan."
// docs/spec.md:125 the Alert carries "Plan, Deadline, Last Position, Adventurer Profile"
// docs/spec.md:29 "Only the Alert carries the full Profile."
// docs/spec.md:142 "The Last Position in an Alert gives the time of the reading and the coordinates."
// docs/spec.md:133 "Every time in a message is in the Adventurer's time zone at Start and does not name the time zone"
// docs/spec.md:151 "from the sender name 🐶 Barry"
test('the Alert carries the latest Plan, the Deadline in the Adventurer’s time zone, the Last Position and the full Profile, which the Heads-up leaves out', async () => {
  const anna = await adventurer();
  must(await anna.client.from('adventurer_profiles').update({ medical_notes: 'Type 1 diabetic' }).eq('id', anna.userId), 'medical notes');
  const id = await anna.start();

  const headsUp = await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  assert.equal(headsUp.From.Name, '🐶 Barry', 'the email comes from 🐶 Barry');
  assert.doesNotMatch(headsUp.Text, /\+41790000001|Subaru|SZ 12345|Type 1 diabetic/, 'the Heads-up carries nothing from the Profile beyond the name');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'West ridge', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  await waitForMail(anna.luca.email, 'Anna changed the plan for Grosser Mythen');

  await missDeadline(id);
  const [{ deadline }] = must(await admin.from('adventures').select('deadline').eq('id', id), 'adventure');
  const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.match(alert.Text, /^Anna has not checked in from an adventure\. The deadline was (.+)\./m);
  assert.equal(alert.Text.match(/The deadline was (.+)\./)[1], inZurich(new Date(deadline)), 'the Deadline is in the Adventurer’s time zone at Start, without naming it');
  assert.doesNotMatch(alert.Text, /Europe|Zurich|CET|CEST|UTC|GMT/);
  assert.match(alert.Text, /Destination: Grosser Mythen\r?\nRoute: West ridge/, 'the Alert carries the latest Plan');
  assert.match(alert.Text, /Last position at .+: 47\.03000, 8\.68000/);
  assert.doesNotMatch(alert.Text, /openstreetmap/, 'the Alert carries no map link');
  assert.match(alert.Text, /Anna's phone: \+41790000001/);
  assert.match(alert.Text, /Car: red Subaru, SZ 12345/);
  assert.match(alert.Text, /Medical notes: Type 1 diabetic/, 'the Alert carries the medical notes');

  const alertText = await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
  assert.match(alertText.body, /Route: West ridge/, 'the text message carries the latest Plan too');
  assert.match(alertText.body, /Medical notes: Type 1 diabetic/);
});
