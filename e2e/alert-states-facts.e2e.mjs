import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Message rules "An Alert states facts only. It gives no guidance on what to do."
test('the Alert states facts only and gives no guidance on what to do', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await missDeadline(id);

  const email = (await waitForMail(anna.luca.email, 'Anna has not checked in')).Text;
  const text = (await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure')).body;
  for (const body of [email, text]) {
    const withoutLinks = body.replace(/https?:\/\/\S+/g, '');
    assert.doesNotMatch(withoutLinks, /\b(112|117|144|1414)\b/, 'the Alert names no emergency number');
    assert.doesNotMatch(withoutLinks, /\b(call|police|rescue|search|should|please)\b/i, 'the Alert gives no advice');
  }
});
