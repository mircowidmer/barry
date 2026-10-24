import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, textsTo, waitForText } from './stack.mjs';

// The GSM-7 alphabet, as supabase/functions/deliver/messages.en.test.ts spells it out.
const GSM_7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€';

// docs/spec.md:172 "Text messages use only the GSM-7 alphabet, so each segment holds 160 characters."
test('every text message a contact receives, link included, uses only the GSM-7 alphabet', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  await waitForText(anna.sara.phone, 'Anna changed the plan');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  must(
    await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'),
    'skip the three-minute wait',
  );
  await waitForText(anna.sara.phone, 'Anna needs more time');

  await missDeadline(id);
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
  must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  const bodies = (await textsTo(anna.sara.phone)).map((m) => m.body);
  assert.equal(bodies.length, 5, 'the Heads-up, the Plan Update, the Deadline Update, the Alert and the All-clear');
  for (const body of bodies) {
    assert.deepEqual([...body].filter((c) => !GSM_7.includes(c)), [], `only GSM-7 characters: ${body.split('\n')[0]}`);
  }
});
