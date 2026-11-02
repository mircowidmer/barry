import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { after, test } from 'node:test';

import { adventurer, must, poll, waitForText } from './stack.mjs';

// SUBSCRIBED only means the channel joined. Realtime hears the database once it says so in a system message, which
// on a fresh stack comes seconds later, and a change committed before then never reaches the listener.
const listen = (client, id) => {
  const changes = [];
  let heard;
  const ready = new Promise((resolve) => (heard = resolve));
  const channel = client
    .channel(`messages:${id}:${randomInt(1e6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `adventure_id=eq.${id}` }, (change) =>
      changes.push(change.new),
    )
    .on('system', {}, (message) => message.extension === 'postgres_changes' && message.status === 'ok' && heard())
    .subscribe();
  // An open Realtime socket keeps the file's process alive, so node --test never moves on.
  after(async () => {
    await client.removeChannel(channel);
    client.realtime.disconnect();
  });
  return { changes, ready };
};

// docs/spec.md § Messages > Sent to your contacts "The list follows while the screen is open: a message appears as soon as it goes out or fails, and a text message turns Delivered when Twilio reports it."
test('the list follows while the screen is open, and a text message turns Delivered when Twilio reports it', async () => {
  const anna = await adventurer();

  // The Adventure exists before the Start, so Anna listens before any message is queued.
  const [saved] = must(
    await anna.client.rpc('save_adventure', {
      p_id: null, p_destination: 'Grosser Mythen', p_deadline: new Date(Date.now() + 2 * 3600_000).toISOString(),
      p_contact_ids: [anna.luca.id, anna.sara.id],
    }),
    'save_adventure',
  );
  const id = saved.adventure_id;
  const annaHears = listen(anna.client, id);
  await annaHears.ready;

  assert.equal(
    must(await anna.client.rpc('start_adventure', { p_id: id, p_time_zone: 'Europe/Zurich', p_latitude: 47.03, p_longitude: 8.68, p_accuracy_m: 12 }), 'start'),
    null,
  );
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const delivered = (m) => m.channel === 'sms' && m.to_address === anna.sara.phone && m.status === 'sent' && m.delivered_at !== null;
  await poll('Realtime change of Sara’s Heads-up to Delivered', async () => annaHears.changes.some(delivered));
  assert.ok(annaHears.changes.some(delivered), 'Anna hears Sara’s Heads-up text message turn Delivered when Twilio reports it');

  const [listed] = must(
    await anna.client.from('adventure_messages').select('channel, delivered').eq('adventure_id', id).eq('channel', 'sms'),
    'adventure_messages',
  );
  assert.equal(listed.delivered, true, 'and the list she reads on that change shows it Delivered');
});
