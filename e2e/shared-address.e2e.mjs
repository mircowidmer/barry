import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, messageKinds, must, textsTo, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:154 "Contacts that share an email address or a phone number get one message per address."
test('two contacts who share an email address and a phone number get one message per address', async () => {
  const anna = await adventurer();
  await anna.contact({ name: 'Mia', email: anna.luca.email, phone: anna.sara.phone });
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
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
    'one Heads-up and one All-clear per address, although two contacts share each',
  );
  assert.equal(await mailCount(anna.luca.email, 'Anna is heading out'), 1, 'one Heads-up email to the shared address');
  assert.equal(await mailCount(anna.luca.email, 'Anna is back safe'), 1, 'one All-clear email to the shared address');
  assert.equal((await textsTo(anna.sara.phone)).length, 2, 'one Heads-up and one All-clear text message to the shared number');
});
