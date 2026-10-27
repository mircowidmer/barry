import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, waitForMail, waitForText } from './stack.mjs';

// The same parts as supabase/functions/deliver/messages.en.ts, so a wrong time zone or a wrong Deadline fails the match.
const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};

// docs/spec.md:102 "quick moves in a row send one Deadline Update, from the time the contact knew to the latest one."
// docs/spec.md:130 the Deadline Update carries "the Deadline the contact knew, the new Deadline"
test('the Deadline Update after two quick moves names the Deadline from the Heads-up and the latest one, by email and by text message', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');
  const { deadline } = must(await admin.from('adventures').select('deadline').eq('id', id).single(), 'adventure');
  const known = new Date(deadline);

  let latest;
  for (const hours of [1, 3]) {
    latest = new Date(known.getTime() + hours * 3600_000);
    assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: latest.toISOString() }), 'move_deadline'), null);
  }
  must(await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'), 'skip the three-minute wait');

  const sentence = `moved the deadline from ${inZurich(known)} to ${inZurich(latest)}. Barry`;
  assert.ok((await waitForMail(anna.luca.email, 'Anna needs more time for Grosser Mythen')).Text.includes(sentence), `the email says "${sentence}"`);
  assert.ok((await waitForText(anna.sara.phone, 'Anna needs more time')).body.includes(sentence), `the text message says "${sentence}"`);
});
