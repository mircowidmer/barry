import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Trail Map "Each contact of an Active, Overdue, or Alerted Adventure has their own Trail Map link. The Heads-up, every
// Plan Update, every Deadline Update, every Alert and the All-clear carry it."
test("each contact's own Trail Map link travels in their Heads-up, Plan Update and Deadline Update", async () => {
  const anna = await adventurer();
  const id = await anna.start();
  const lucaToken = trailToken((await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen')).Text);
  const saraToken = trailToken((await waitForText(anna.sara.phone, 'Anna is going on an adventure alone')).body);
  assert.ok(lucaToken && saraToken && lucaToken !== saraToken, 'Luca and Sara each have their own link');
  assert.equal((await trailMap(lucaToken)).status, 'underway');
  assert.equal((await trailMap(saraToken)).status, 'underway', 'both links open the Trail Map');

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Kleiner Mythen', p_deadline: null, p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  assert.equal(trailToken((await waitForMail(anna.luca.email, 'Anna changed the plan for Kleiner Mythen')).Text), lucaToken, "Luca's Plan Update carries his link");
  assert.equal(trailToken((await waitForText(anna.sara.phone, 'Anna changed the plan')).body), saraToken, "Sara's Plan Update carries hers");

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  must(
    await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'),
    'skip the three-minute wait',
  );
  assert.equal(trailToken((await waitForMail(anna.luca.email, 'Anna needs more time for Kleiner Mythen')).Text), lucaToken, "Luca's Deadline Update carries his link");
  assert.equal(trailToken((await waitForText(anna.sara.phone, 'Anna needs more time')).body), saraToken, "Sara's Deadline Update carries hers");
});
