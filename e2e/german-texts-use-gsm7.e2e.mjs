import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, paceOver, runDeliver, textsTo, tick, waitForText } from './stack.mjs';

// The GSM-7 alphabet, as supabase/functions/deliver/messages.en.test.ts spells it out.
const GSM_7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€';

// docs/text-messages.md § Segments "The German texts in `messages.de.ts` use only GSM-7 characters too, because ä, ö and ü are in the alphabet."
test('the German text messages, link included, use only GSM-7 characters too', async () => {
  const anna = await adventurer();
  must(await anna.client.from('adventurer_profiles').update({ message_language: 'de' }).eq('id', anna.userId), 'choose German');
  const id = await anna.start();
  await waitForText(anna.sara.phone, 'Anna ist allein auf einem Abenteuer');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  await paceOver(id);
  await runDeliver();
  await waitForText(anna.sara.phone, 'Anna hat den Plan geändert');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  await paceOver(id);
  await runDeliver();
  await waitForText(anna.sara.phone, 'Anna braucht mehr Zeit');

  await missDeadline(id);
  tick();
  await waitForText(anna.sara.phone, 'Anna hat sich nach einem Abenteuer nicht zurückgemeldet');
  must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
  await waitForText(anna.sara.phone, 'Anna hat sich am');

  const bodies = (await textsTo(anna.sara.phone)).map((m) => m.body);
  assert.equal(bodies.length, 5, 'the Heads-up, the Plan Update, the Deadline Update, the Alert and the All-clear');
  for (const body of bodies) {
    assert.deepEqual([...body].filter((c) => !GSM_7.includes(c)), [], `only GSM-7 characters: ${body.split('\n')[0]}`);
  }
});
