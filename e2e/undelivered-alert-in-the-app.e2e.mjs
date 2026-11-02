import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, appMessages, missDeadline, must, poll, tick, waitForMail, waitForText } from './stack.mjs';

// docs/text-messages.md § Delivery reports "`undelivered` or `failed` turns the message into `failed`, with Twilio's error as the reason"
// docs/text-messages.md § Delivery reports "The app shows it as a Delivery Failure"
// The local relay reports a text message to a number ending in 30003 as undelivered, like Twilio.
test('an Alert text message Twilio reports undelivered is one the app shows as a Delivery Failure, beside the email Alert that was sent', async () => {
  const anna = await adventurer();
  const unreachable = `+41790${String(randomInt(100)).padStart(2, '0')}30003`;
  must(await anna.client.from('emergency_contacts').update({ phone: unreachable }).eq('id', anna.sara.id), 'give Sara an unreachable number');

  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await missDeadline(id);
  tick();
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(unreachable, 'Anna has not checked in from an adventure');

  // The same query as undeliveredMessages in src/lib/barry/client.ts, on Anna's own session.
  const undelivered = async () =>
    must(await appMessages(anna.client, id).eq('undelivered', true), 'undelivered messages');
  const listed = await poll('undelivered Alert in the list', async () => {
    const found = await undelivered();
    return found.some((m) => m.kind === 'alert') && found;
  });
  const sara = [{ id: anna.sara.id, name: 'Sara' }];
  assert.deepEqual(
    listed
      .map(({ kind, round, channel, to_address, status, undelivered, failure_reason, contacts }) => ({
        kind, round, channel, to_address, status, undelivered, failure_reason, contacts,
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    [
      { kind: 'alert', round: 1, channel: 'sms', to_address: unreachable, status: 'failed', undelivered: true, failure_reason: 'Twilio 30003: Unreachable destination handset', contacts: sara },
      { kind: 'heads_up', round: null, channel: 'sms', to_address: unreachable, status: 'failed', undelivered: true, failure_reason: 'Twilio 30003: Unreachable destination handset', contacts: sara },
    ],
    'Anna’s app lists the Alert text to Sara as undelivered, with Twilio’s reason, beside Sara’s undelivered Heads-up',
  );

  const emailAlerts = must(
    await anna.client.from('adventure_messages').select('kind, round, channel, status, undelivered, contacts').eq('adventure_id', id).eq('kind', 'alert').eq('channel', 'email'),
    'email Alerts',
  );
  assert.deepEqual(
    emailAlerts,
    [{ kind: 'alert', round: 1, channel: 'email', status: 'sent', undelivered: false, contacts: [{ id: anna.luca.id, name: 'Luca' }] }],
    'Anna’s app lists Luca’s email Alert as sent',
  );
});
