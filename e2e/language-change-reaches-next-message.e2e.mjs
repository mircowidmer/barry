import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:168 "The app stores that language in the Profile each time it opens and each time the Profile is saved, so a
// language changed in Settings reaches the next message."
test('a language the Adventurer changes during the Adventure decides the language of the next message, the Alert', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  must(await anna.client.from('adventurer_profiles').update({ message_language: 'de' }).eq('id', anna.userId), 'choose German');
  await missDeadline(id);

  await waitForMail(anna.luca.email, 'Anna hat sich nicht zurückgemeldet');
  await waitForText(anna.sara.phone, 'Anna hat sich nach einem Abenteuer nicht zurückgemeldet');
  assert.equal(await mailCount(anna.luca.email, 'Anna has not checked in'), 0, 'Luca got no English Alert');
});
