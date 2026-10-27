import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { API, admin, adventurer, must, sleep, waitForText } from './stack.mjs';

const DELIVER_SECRET = readFileSync('supabase/config.toml', 'utf8').match(/^DELIVER_SECRET = "(.+)"$/m)[1];

// The same token as supabase/functions/deliver/delivery-report.ts, so only the part under test is wrong.
const reportToken = (messageId) => createHmac('sha256', DELIVER_SECRET).update(`delivery-report:${messageId}`).digest('hex').slice(0, 32);

const report = (messageId, token, sid) =>
  fetch(`${API}/functions/v1/deliver/status?message=${messageId}&token=${token}`, {
    method: 'POST',
    body: new URLSearchParams({ MessageSid: sid, MessageStatus: 'undelivered', ErrorCode: '30003' }),
  });

// docs/text-messages.md § Delivery reports "the token in the URL is an HMAC of the message ID made with DELIVER_SECRET"
// docs/text-messages.md § Delivery reports "A report for a text message the database does not know, or with another Twilio sid, changes nothing."
test('a delivery report with a wrong token, another Twilio sid or an unknown message changes nothing', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  const row = async () =>
    must(await admin.from('messages').select('id, status, provider_ref, delivered_at, failure_reason').eq('adventure_id', id).eq('channel', 'sms').single(), 'message');
  let delivered = await row();
  for (let tries = 0; tries < 20 && !delivered.delivered_at; tries++) {
    await sleep(1);
    delivered = await row();
  }
  assert.ok(delivered.delivered_at, 'the relay reported Sara’s Heads-up delivered');

  const wrongToken = await report(delivered.id, '0'.repeat(32), delivered.provider_ref);
  assert.equal(wrongToken.status, 401, 'a report with a wrong token is refused');
  const otherSid = await report(delivered.id, reportToken(delivered.id), 'SM-not-the-sid-Barry-stored');
  assert.equal(otherSid.status, 204);
  const unknown = await report(2 ** 31 - 1, reportToken(2 ** 31 - 1), delivered.provider_ref);
  assert.equal(unknown.status, 204);

  assert.deepEqual(await row(), delivered, 'Sara’s Heads-up is still sent and delivered');
  assert.deepEqual(must(await anna.client.from('delivery_failures').select('kind').eq('adventure_id', id), 'Delivery Failures'), [], 'and it is no Delivery Failure');
});
