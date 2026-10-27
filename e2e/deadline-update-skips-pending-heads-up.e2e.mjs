import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, messageKinds, must, runDeliver, waitForMail, waitForText } from './stack.mjs';

const inZurich = (at) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')}, ${part('hour')}:${part('minute')}`;
};
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// docs/spec.md § Adventures > Move the Deadline "A move sends a Deadline Update to each contact whose Heads-up already went out. A contact whose Heads-up is
// still on its way gets none, because the Heads-up carries the new Deadline."
test('a contact whose Heads-up is still on its way gets no Deadline Update, and the Heads-up carries the new Deadline', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  // Mia joined while deliver was busy: her Heads-up is claimed and on its way, and nothing sends it until the lease below is released.
  const mia = await anna.contact({ name: 'Mia', email: anna.luca.email.replace('luca-', 'mia-') });
  must(await admin.from('adventure_contacts').insert({ adventure_id: id, contact_id: mia.id }), 'Mia on the Adventure');
  const [held] = must(
    await admin
      .from('messages')
      .insert({
        adventure_id: id, kind: 'heads_up', channel: 'email', to_address: mia.email, contact_id: mia.id,
        status: 'sending', attempts: 1, lease_until: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .select('id'),
    'a Heads-up still on its way',
  );

  const later = new Date(Date.now() + 3 * 3600_000);
  assert.equal(must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: later.toISOString() }), 'move_deadline'), null);
  const waiting = (await messageKinds(id)).filter((m) => m.kind === 'deadline_update').map((m) => m.to_address).sort();
  assert.deepEqual(waiting, [anna.luca.email, anna.sara.phone].sort(), 'Luca and Sara get a Deadline Update; Mia, whose Heads-up is still on its way, gets none');

  must(await admin.from('messages').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('id', held.id), 'release the lease');
  await runDeliver();
  const headsUp = await waitForMail(mia.email, 'Anna is heading out to Grosser Mythen');
  assert.match(headsUp.Text, new RegExp(`If Anna has not checked in by ${literally(inZurich(later))}, Barry will message you again`), 'her Heads-up carries the new Deadline');
});
