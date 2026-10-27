import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, hourAfterAlert, mailCount, messageKinds, missDeadline, must, sleep, tick, waitForMail } from './stack.mjs';

const waitForMailCount = async (to, subject, count) => {
  for (let i = 0; i < 75; i++) {
    if ((await mailCount(to, subject)) >= count) return;
    await sleep(2);
  }
  throw new Error(`no ${count} emails "${subject}" to ${to} within 150 seconds`);
};

// docs/spec.md § Adventures > Move the Deadline "The Adventurer can move the Deadline later at any time until the Check-in, also after the Alert, as long as the new Deadline is in the future."
// docs/spec.md § Adventures > Move the Deadline "When a moved Deadline passes too, the contacts get up to three Alerts for it, the same way as for the first one."
test('after the third Alert the Adventurer moves the Deadline, and missing it sends three more Alerts', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await hourAfterAlert(id);
  await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)');
  await hourAfterAlert(id);
  await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 3 of 3)');

  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: past }), 'move_deadline'), 'deadline_not_in_future', 'the new Deadline must be in the future');
  const later = new Date(Date.now() + 2 * 3600_000).toISOString();
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null, 'an Alerted Adventure moves its Deadline');
  const [moved] = must(await admin.from('adventures').select('stage, alerts_sent, earlier_alerts').eq('id', id), 'adventure');
  assert.deepEqual(moved, { stage: 'active', alerts_sent: 0, earlier_alerts: 3 }, 'it is Active again and keeps the three Alerts it had');

  must(await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'), 'skip the wait');
  tick();
  await waitForMail(anna.luca.email, 'Anna needs more time');

  await missDeadline(id);
  await waitForMailCount(anna.luca.email, 'Anna has not checked in', 2);
  await hourAfterAlert(id);
  await waitForMailCount(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)', 2);
  await hourAfterAlert(id);
  await waitForMailCount(anna.luca.email, 'Anna has still not checked in (alert 3 of 3)', 2);

  await hourAfterAlert(id);
  const alerts = (await messageKinds(id)).filter((m) => m.kind === 'alert');
  assert.equal(alerts.filter((m) => m.to_address === anna.luca.email && m.status === 'sent').length, 6, 'three Alerts for each Deadline, and the fourth hour added none');
  const [after] = must(await admin.from('adventures').select('stage, alerts_sent, earlier_alerts').eq('id', id), 'adventure');
  assert.deepEqual(after, { stage: 'alerted', alerts_sent: 3, earlier_alerts: 3 });

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
});
