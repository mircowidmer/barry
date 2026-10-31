import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, test } from 'node:test';

import { adventurer, must, sleep, waitForMail, waitForText } from './stack.mjs';

const listen = (client, id) => {
  const statuses = [];
  const channel = client
    .channel(`messages:${id}:${randomInt(1e6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `adventure_id=eq.${id}` }, (change) =>
      statuses.push(change.new.status),
    );
  const ready = new Promise((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
  // An open Realtime socket keeps the file's process alive, so node --test never moves on.
  after(async () => {
    await client.removeChannel(channel);
    client.realtime.disconnect();
  });
  return { statuses, ready };
};

// The local relay reports a text message to a number ending in 30003 as undelivered, like Twilio.
test('The Adventurer sees each message to the contacts as it goes out, is delivered or fails, and nobody else sees them', async () => {
  const anna = await adventurer();
  const marco = await adventurer();
  const unreachable = `+41790${String(randomInt(100)).padStart(2, '0')}30003`;
  must(await anna.client.from('emergency_contacts').update({ phone: unreachable }).eq('id', anna.sara.id), 'give Sara an unreachable number');

  // The Adventure exists before the Start, so both listen before any message is queued.
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
      p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const id = saved.adventure_id;
  const annaHears = listen(anna.client, id);
  const marcoHears = listen(marco.client, id);
  await Promise.all([annaHears.ready, marcoHears.ready]);

  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start'),
    null,
  );
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(unreachable, 'Anna is going on an adventure alone');

  let listed = [];
  for (let tries = 0; tries < 30; tries++) {
    listed = must(await anna.client.from('adventure_messages').select('kind, channel, status, contacts').eq('adventure_id', id), 'adventure_messages');
    if (listed.some((m) => m.status === 'failed') && annaHears.statuses.includes('failed')) break;
    await sleep(1);
  }
  assert.deepEqual(
    listed.map((m) => `${m.kind} ${m.channel} ${m.status} ${m.contacts.map((c) => c.name).join(',')}`).sort(),
    ['heads_up email sent Luca', 'heads_up sms failed Sara'],
    'Anna lists Luca’s Heads-up as sent and Sara’s as failed',
  );
  assert.ok(annaHears.statuses.includes('sent'), 'Anna hears the Heads-up go out');
  assert.ok(annaHears.statuses.includes('failed'), 'Anna hears Sara’s Heads-up fail when Twilio reports it');

  // A moved Deadline sends its Deadline Update only a few minutes later, so it waits in the outbox meanwhile.
  must(await anna.client.rpc('move_deadline', { p_id: id, p_deadline: new Date(Date.now() + 3 * 3600_000).toISOString() }), 'move_deadline');
  const kinds = must(await anna.client.from('adventure_messages').select('kind').eq('adventure_id', id), 'adventure_messages').map((m) => m.kind);
  assert.ok(!kinds.includes('deadline_update'), 'The waiting Deadline Update is not listed');

  assert.deepEqual(must(await marco.client.from('adventure_messages').select('id').eq('adventure_id', id), 'Marco reads'), [], 'Marco reads none of them');
  await sleep(2);
  assert.deepEqual(marcoHears.statuses, [], 'Marco hears none of them');
});
