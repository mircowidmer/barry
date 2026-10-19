import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, messageKinds, missDeadline, must, textsTo, trailMap, trailToken, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md:111 "A contact removed from the Adventure gets no further messages, and their Trail Map link stops working."
// docs/spec.md:109 "Changing only the contacts, or moving the Deadline, sends no Plan Update."
test('a contact removed from the Adventure gets neither the Alert nor the All-clear, and the change alone sends no Plan Update', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const saraToken = trailToken((await waitForText(anna.sara.phone, 'Anna is going on an adventure alone')).body);

  must(
    await anna.client.rpc('save_adventure', {
      p_id: id, p_destination: 'Grosser Mythen', p_route: 'East ridge', p_deadline: null, p_contact_ids: [anna.luca.id],
    }),
    'remove Sara from the Adventure',
  );
  assert.equal(await trailMap(saraToken), null, 'Sara’s Trail Map link stops working');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');

  const rows = await messageKinds(id);
  assert.deepEqual(
    rows.filter((m) => m.to_address === anna.sara.phone).map((m) => m.kind),
    ['heads_up'],
    'Sara’s phone number has the Heads-up and nothing further, not the Alert and not the All-clear',
  );
  assert.deepEqual(
    rows.filter((m) => m.to_address === anna.luca.email).map((m) => m.kind).sort(),
    ['alert', 'all_clear', 'heads_up'],
    'Luca, who stayed, got the Alert and the All-clear',
  );
  assert.equal(rows.some((m) => m.kind === 'plan_update'), false, 'changing only the contacts sent no Plan Update');
  assert.equal((await textsTo(anna.sara.phone)).length, 1, 'Sara got one text message, the Heads-up');
});
