import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, hourAfterAlert, mailCount, messageKinds, missDeadline, must, sleep, waitForMail } from './stack.mjs';

const waitForMailCount = async (to, subject, count) => {
  for (let i = 0; i < 75; i++) {
    if ((await mailCount(to, subject)) >= count) return;
    await sleep(2);
  }
  throw new Error(`no ${count} emails "${subject}" to ${to} within 150 seconds`);
};

// docs/spec.md § Adventures > Move the Deadline "An Adventure brings at most nine Alerts in all. Once a moved Deadline's three Alerts would pass nine, a move is refused, so every Deadline still gets all its Alerts and the Check-in is the only way to end the Adventure."
test('an Adventure brings at most nine Alerts, and the move that could bring a tenth is refused', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  const move = async () =>
    must(
      await anna.client.rpc('move_deadline', { p_id: id, p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString() }),
      'move_deadline',
    );

  for (let deadline = 1; deadline <= 3; deadline += 1) {
    await missDeadline(id);
    await waitForMailCount(anna.luca.email, 'Anna has not checked in', deadline);
    if (deadline === 3) assert.equal(await move(), 'too_many_alerts', 'with seven Alerts, three more would pass nine');
    await hourAfterAlert(id);
    await waitForMailCount(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)', deadline);
    await hourAfterAlert(id);
    await waitForMailCount(anna.luca.email, 'Anna has still not checked in (alert 3 of 3)', deadline);
    if (deadline < 3) assert.equal(await move(), null, `the move after Deadline ${deadline} goes through`);
  }

  assert.equal(await move(), 'too_many_alerts', 'with nine Alerts the Deadline cannot move again');
  await hourAfterAlert(id);
  const sent = (await messageKinds(id)).filter((m) => m.kind === 'alert' && m.to_address === anna.luca.email && m.status === 'sent');
  assert.equal(sent.length, 9, 'nine Alerts went out, and the hour after the last added none');
  const [after] = must(await admin.from('adventures').select('stage, alerts_sent, earlier_alerts').eq('id', id), 'adventure');
  assert.deepEqual(after, { stage: 'alerted', alerts_sent: 3, earlier_alerts: 6 }, 'the refused moves left it Alerted');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
});
