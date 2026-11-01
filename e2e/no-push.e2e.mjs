import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/notifications.md § Notifications "Supabase has the push channel turned off and queues no push rows for them."
test('Supabase has the push channel turned off and queues no push rows, even for an Adventurer with a push device', async () => {
  const anna = await adventurer();
  must(await anna.client.from('push_devices').insert({ expo_push_token: `ExponentPushToken[${anna.userId}]` }), 'push device');
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  await waitForText(anna.sara.phone, 'Anna checked in safely');

  const rows = must(await admin.from('messages').select('kind, channel').eq('adventure_id', id), 'messages');
  assert.deepEqual(
    [...new Set(rows.map((m) => m.kind))].sort(),
    ['alert', 'all_clear', 'heads_up'],
    'the Heads-up, the Alert and the All-clear were queued',
  );
  assert.deepEqual(rows.filter((m) => m.channel === 'push'), [], 'no push row was queued');
});
