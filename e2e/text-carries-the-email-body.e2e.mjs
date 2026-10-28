import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Channels "A text message carries the same text as the email body, without the subject."
test('the text message of every kind carries the same text as the email body', async () => {
  const anna = await adventurer();
  const phone = `+4179${String(randomInt(1e7)).padStart(7, '0')}`;
  must(await anna.client.from('emergency_contacts').update({ phone }).eq('id', anna.luca.id), 'give Luca a phone number too');
  const id = await anna.start();

  const pairs = [];
  const pair = async (subject, start) => {
    const mail = await waitForMail(anna.luca.email, subject);
    const text = await waitForText(phone, start);
    pairs.push([subject, mail.Text.trim(), text.body.trim()]);
  };
  await pair('Anna is heading out to Grosser Mythen', 'Anna is going on an adventure alone');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  await pair('Anna changed the plan for Kleiner Mythen', 'Anna changed the plan');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  must(
    await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'),
    'skip the three-minute wait',
  );
  await pair('Anna needs more time for Kleiner Mythen', 'Anna needs more time');

  await missDeadline(id);
  await pair('Anna has not checked in', 'Anna has not checked in from an adventure');

  must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
  await pair('Anna is back safe', 'Anna checked in safely');

  assert.equal((await textsTo(phone)).length, 5, 'one text message per kind');
  for (const [subject, email, text] of pairs) assert.equal(text, email, `the text message of "${subject}" is the email body`);
});
