import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, hourAfterAlert, messageKinds, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Messages "The Grace Period ends, then every hour, up to three Alerts in total"
// docs/spec.md § Messages > Message rules "After the third Alert for a Deadline, Barry sends nothing more for it. The Adventure stays Alerted until the Adventurer checks in or moves the Deadline."
// docs/spec.md § Messages > Reminder and Overdue Notice "Supabase does not push either notification."
test('the second and third Alert follow an hour apart, nothing follows the third, and the Check-in still ends it', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');

  await hourAfterAlert(id);
  const second = await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 2 of 3)');
  assert.match(second.Text, /^Anna has still not checked in from an adventure \(alert 2 of 3\)\. The deadline was /);
  await waitForText(anna.sara.phone, 'Anna has still not checked in from an adventure (alert 2 of 3)');

  await hourAfterAlert(id);
  await waitForMail(anna.luca.email, 'Anna has still not checked in (alert 3 of 3)');
  await waitForText(anna.sara.phone, 'Anna has still not checked in from an adventure (alert 3 of 3)');

  await hourAfterAlert(id);
  const rows = await messageKinds(id);
  assert.deepEqual(
    rows.filter((m) => m.kind === 'alert').map((m) => [m.to_address, m.status]).sort(),
    [1, 2, 3].flatMap(() => [[anna.luca.email, 'sent'], [anna.sara.phone, 'sent']]).sort(),
    'three Alerts went to each address, and the fourth hour added none',
  );
  assert.equal(rows.some((m) => m.kind === 'reminder' || m.kind === 'overdue_notice'), false, 'Supabase pushed neither the Reminder nor the Overdue Notice');
  const [after] = must(await admin.from('adventures').select('stage, alerts_sent').eq('id', id), 'adventure');
  assert.deepEqual(after, { stage: 'alerted', alerts_sent: 3 }, 'the Adventure stays Alerted with three Alerts sent');

  assert.equal(must(await anna.client.rpc('check_in', { p_id: id, p_checked_in_at: new Date().toISOString() }), 'check_in'), null);
  await waitForMail(anna.luca.email, 'Anna is back safe');
  const [ended] = must(await admin.from('adventures').select('stage').eq('id', id), 'adventure');
  assert.equal(ended.stage, 'ended', 'the Check-in is the only way to end it');
});
