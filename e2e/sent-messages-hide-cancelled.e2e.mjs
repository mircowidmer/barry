import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, appMessages, messageKinds, messagesOut, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages > Sent to your contacts "A message still waiting, such as a Deadline Update held back by the pace, or one Barry cancelled, is not listed."
test('a message Barry cancelled is not listed', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');
  await messagesOut(id);

  assert.deepEqual(
    (await messageKinds(id)).filter((m) => m.kind === 'deadline_update').map((m) => m.status),
    ['cancelled', 'cancelled'],
    'the Check-in cancelled the waiting Deadline Update to each address',
  );
  const listed = must(await appMessages(anna.client, id), 'adventure_messages');
  assert.deepEqual(
    listed.map((m) => `${m.kind} ${m.channel}`).sort(),
    ['all_clear email', 'all_clear sms', 'heads_up email', 'heads_up sms'],
    'Anna lists the Heads-ups and the All-clears, and not the cancelled Deadline Updates',
  );
});
