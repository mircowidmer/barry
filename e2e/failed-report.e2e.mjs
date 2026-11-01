import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { API, admin, adventurer, must, poll, waitForText } from './stack.mjs';

const DELIVER_SECRET = readFileSync('supabase/config.toml', 'utf8').match(/^DELIVER_SECRET = "(.+)"$/m)[1];

// The same token as supabase/functions/deliver/delivery-report.ts, the one Twilio finds in its StatusCallback.
const reportToken = (messageId) => createHmac('sha256', DELIVER_SECRET).update(`delivery-report:${messageId}`).digest('hex').slice(0, 32);

// docs/text-messages.md § Delivery reports "`undelivered` or `failed` turns the message into `failed`, with Twilio's error as the reason"
// docs/text-messages.md § Delivery reports "The app shows it as a Delivery Failure"
// The local relay only ever reports delivered or undelivered, so this case posts Twilio's failed report itself. It waits for the
// relay's delivered report first, so the two cannot race: a failed report still fails a message that is sent.
test('a failed delivery report turns the text message into failed, with Twilio’s error as the reason, and the app shows it as a Delivery Failure', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const row = async () =>
    must(await admin.from('messages').select('id, status, provider_ref, delivered_at, failure_reason').eq('adventure_id', id).eq('channel', 'sms').single(), 'message');
  const headsUp = await poll('delivery report for Sara’s Heads-up', async () => {
    const found = await row();
    return found.delivered_at && found;
  });
  assert.ok(headsUp.delivered_at, 'the relay’s own report for Sara’s Heads-up is in');

  const response = await fetch(`${API}/functions/v1/deliver/status?message=${headsUp.id}&token=${reportToken(headsUp.id)}`, {
    method: 'POST',
    body: new URLSearchParams({ MessageSid: headsUp.provider_ref, MessageStatus: 'failed', ErrorCode: '30008' }),
  });
  assert.equal(response.status, 204, 'deliver accepts the report');

  const reported = await row();
  assert.deepEqual([reported.status, reported.failure_reason], ['failed', 'Twilio 30008: Unknown error'], 'Sara’s Heads-up is failed with Twilio’s error');
  assert.deepEqual(
    must(await anna.client.from('adventure_messages').select('kind, channel, status, failure_reason, undelivered').eq('adventure_id', id).eq('undelivered', true), 'undelivered messages'),
    [{ kind: 'heads_up', channel: 'sms', status: 'failed', failure_reason: 'Twilio 30008: Unknown error', undelivered: true }],
    'Anna’s app lists Sara’s Heads-up as undelivered',
  );
});
