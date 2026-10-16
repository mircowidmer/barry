import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, mailCount, messageKinds, must, textsTo, waitForMail, waitForText } from './stack.mjs';

test('Barry reaches a contact only on the addresses that are switched on', async () => {
  const anna = await adventurer();
  const lucaPhone = `+4179${String(randomInt(1e7)).padStart(7, '0')}`;
  const saraEmail = anna.luca.email.replace('luca-', 'sara-');
  must(
    await anna.client.from('emergency_contacts').update({ phone: lucaPhone, phone_enabled: false }).eq('id', anna.luca.id),
    'switch off Luca’s phone number',
  );
  must(
    await anna.client.from('emergency_contacts').update({ email: saraEmail, email_enabled: false }).eq('id', anna.sara.id),
    'switch off Sara’s email address',
  );
  const { error } = await anna.client.from('emergency_contacts').update({ phone_enabled: false }).eq('id', anna.sara.id);
  assert.ok(error, 'Sara cannot have every address switched off');

  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in');
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  assert.deepEqual(
    (await messageKinds(id)).map((m) => [m.kind, m.to_address]).sort(),
    [
      ['all_clear', anna.sara.phone],
      ['all_clear', anna.luca.email],
      ['heads_up', anna.sara.phone],
      ['heads_up', anna.luca.email],
    ].sort(),
    'the Heads-up and the All-clear went only to Luca’s email address and Sara’s phone number',
  );
  assert.equal((await textsTo(lucaPhone)).length, 0, 'Luca’s switched-off phone number got no text message');
  assert.equal(await mailCount(saraEmail, 'Anna'), 0, 'Sara’s switched-off email address got no email');
});
