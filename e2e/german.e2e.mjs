import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, waitForMail, waitForText } from './stack.mjs';

test('an Adventurer who chose German sends the contacts German messages', async () => {
  const anna = await adventurer();
  must(await anna.client.from('adventurer_profiles').update({ message_language: 'de' }).eq('id', anna.userId), 'choose German');

  const id = await anna.start();
  const headsUp = await waitForMail(anna.luca.email, 'Anna ist unterwegs: Grosser Mythen');
  assert.match(headsUp.Text, /^Anna ist allein auf einem Abenteuer/);
  assert.match(headsUp.Text, /Route: East ridge/);
  const headsUpText = await waitForText(anna.sara.phone, 'Anna ist allein auf einem Abenteuer');
  assert.match(headsUpText.body, /Wenn sich Anna bis .+ um \d\d:\d\d nicht zurückgemeldet hat/);

  must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
  await waitForMail(anna.luca.email, 'Anna ist sicher');
  await waitForText(anna.sara.phone, 'Anna hat sich am');
});
