import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, missDeadline, must, sleep, waitForMail, waitForText } from './stack.mjs';

// The columns the app reads, as MESSAGE_SELECT in src/lib/barry/rows.ts names them.
const MESSAGE_SELECT = 'id, kind, round, channel, to_address, contacts, status, delivered, outcome_at, failure_reason, undelivered';

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
  await waitForMail(anna.luca.email, 'Anna has not checked in');
  await waitForText(unreachable, 'Anna has not checked in from an adventure');

  // The same query as undeliveredMessages in src/lib/barry/client.ts, on Anna's own session.
  const undelivered = async () =>
    must(await anna.client.from('adventure_messages').select(MESSAGE_SELECT).eq('adventure_id', id).eq('undelivered', true), 'undelivered messages');
  let listed = [];
  for (let tries = 0; tries < 20 && !listed.some((m) => m.kind === 'alert'); tries++) {
    if (tries > 0) await sleep(1);
    listed = await undelivered();
  }
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
