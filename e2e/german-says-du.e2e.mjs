import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Channels "The German texts use Swiss Standard German, with "ss" instead of "ß", and address the contact as "du"."
test('the German Heads-up, Alert and All-clear use ss, never ß, and address the contact as du', async () => {
  const anna = await adventurer();
  must(await anna.client.from('adventurer_profiles').update({ message_language: 'de' }).eq('id', anna.userId), 'choose German');
  const id = await anna.start();

  const bodies = [];
  bodies.push((await waitForMail(anna.luca.email, 'Anna ist unterwegs: Grosser Mythen')).Text);
  bodies.push((await waitForText(anna.sara.phone, 'Anna ist allein auf einem Abenteuer')).body);
  await missDeadline(id);
  bodies.push((await waitForMail(anna.luca.email, 'Anna hat sich nicht zurückgemeldet')).Text);
  bodies.push((await waitForText(anna.sara.phone, 'Anna hat sich nach einem Abenteuer nicht zurückgemeldet')).body);
  must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
  bodies.push((await waitForMail(anna.luca.email, 'Anna ist sicher')).Text);
  bodies.push((await waitForText(anna.sara.phone, 'Anna hat sich am')).body);

  assert.equal(bodies.length, 6, 'the Heads-up, the Alert and the All-clear by email and by text message');
  for (const body of bodies) {
    assert.doesNotMatch(body, /ß/, `no ß: ${body.split('\n')[0]}`);
    assert.doesNotMatch(body, /\b(Sie|Ihnen|Ihr\w*)\b/, `no formal address: ${body.split('\n')[0]}`);
    assert.match(body, /\b(du|dich|dir|dein\w*)\b/, `du: ${body.split('\n')[0]}`);
  }
});
