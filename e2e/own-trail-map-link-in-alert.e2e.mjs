import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, tick, trailToken, waitForMail, waitForText } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/trail.md § Trail and Trail Map "Each Emergency Contact gets their own Trail Map link in the
// Heads-up, every Plan Update, every Deadline Update, every Alert and the All-clear."
test('each Emergency Contact gets their own Trail Map link in the Heads-up, every Alert and the All-clear', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const lucaToken = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  const saraToken = trailToken((await waitForText(anna.sara.phone, 'Anna is going on an adventure alone')).body);
  assert.ok(lucaToken && saraToken, 'both Heads-ups carry a Trail Map link');
  assert.notEqual(saraToken, lucaToken, 'Sara and Luca each have their own link');

  await missDeadline(id);
  tick();
  assert.equal(trailToken((await waitForMail(anna.luca.email, 'Anna has not checked in')).Text), lucaToken, "Luca's Alert carries his link");
  assert.equal(trailToken((await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure')).body), saraToken, "Sara's Alert carries hers");

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  assert.equal(trailToken((await waitForMail(anna.luca.email, 'Anna is back safe')).Text), lucaToken, "Luca's All-clear carries his link");
  assert.equal(trailToken((await waitForText(anna.sara.phone, 'Anna checked in safely')).body), saraToken, "Sara's All-clear carries hers");
});
