import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, mailCount, messageKinds, must, textsTo, waitForMail, waitForText } from './stack.mjs';

test('two quick Deadline moves send one Deadline Update, from the first Deadline to the latest', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const [{ deadline }] = must(await admin.from('adventures').select('deadline').eq('id', id), 'adventure');
  for (const hours of [1, 2]) {
    const later = new Date(new Date(deadline).getTime() + hours * 3600_000).toISOString();
    assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later }), 'move_deadline'), null);
  }

  const waiting = (await messageKinds(id)).filter((m) => m.kind === 'deadline_update');
  assert.deepEqual(
    waiting.map((m) => [m.to_address, m.status]).sort(),
    [
      [anna.sara.phone, 'pending'],
      [anna.luca.email, 'pending'],
    ].sort(),
    'one Deadline Update per address waits, not one per move',
  );
  must(
    await admin.from('messages').update({ next_attempt_at: new Date().toISOString() }).eq('adventure_id', id).eq('kind', 'deadline_update'),
    'skip the three-minute wait',
  );

  const mail = await waitForMail(anna.luca.email, 'Anna needs more time for Grosser Mythen');
  const [, from, to] = mail.Text.match(/moved the deadline from (.+) to (.+)\. Barry/) ?? [];
  assert.ok(from && to && from !== to, 'the Deadline Update names the earlier and the new Deadline');
  assert.match(mail.Text, new RegExp(`If Anna has not checked in by ${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, Barry will message you again`));
  const text = await waitForText(anna.sara.phone, 'Anna needs more time and moved the deadline');
  const withoutTrail = (body) => body.split('\nFollow')[0];
  assert.equal(withoutTrail(text.body), withoutTrail(mail.Text), 'the text message carries the email body, with Sara’s own Trail Map link');

  assert.equal(await mailCount(anna.luca.email, 'Anna needs more time'), 1, 'Luca got one Deadline Update');
  assert.equal(
    (await textsTo(anna.sara.phone)).filter((m) => m.body.startsWith('Anna needs more time')).length,
    1,
    'Sara got one Deadline Update',
  );
});
