import { assertEquals, assertMatch } from 'jsr:@std/assert@1.0.13';

import { readDeliveryReport, reportToken, reportUrl } from './delivery-report.ts';

const secret = 'test-deliver-secret';
const form = (fields: Record<string, string>) => new URLSearchParams(fields);
const urlFor = async (messageId: number) => new URL(await reportUrl('https://barry.example', secret, messageId));

Deno.test('the callback URL names the message and carries its own token', async () => {
  const url = await urlFor(7);
  assertEquals(url.pathname, '/functions/v1/deliver/status');
  assertEquals(url.searchParams.get('message'), '7');
  assertMatch(url.searchParams.get('token')!, /^[0-9a-f]{32}$/);
  assertEquals(url.searchParams.get('token'), await reportToken(secret, 7));
});

Deno.test('a delivered report gives the message and the Twilio sid', async () => {
  assertEquals(await readDeliveryReport(await urlFor(7), form({ MessageSid: 'SM123', MessageStatus: 'delivered' }), secret), {
    kind: 'report',
    messageId: 7,
    providerRef: 'SM123',
    status: 'delivered',
    reason: null,
  });
});

Deno.test('an undelivered report names the Twilio error', async () => {
  const report = await readDeliveryReport(
    await urlFor(7),
    form({ MessageSid: 'SM123', MessageStatus: 'undelivered', ErrorCode: '30003' }),
    secret,
  );
  assertEquals(report?.kind === 'report' && report.reason, 'Twilio 30003: Unreachable destination handset');
  const unknown = await readDeliveryReport(await urlFor(7), form({ MessageSid: 'SM1', MessageStatus: 'failed', ErrorCode: '30999' }), secret);
  assertEquals(unknown?.kind === 'report' && unknown.reason, 'Twilio 30999: failed');
});

Deno.test('statuses before the final one are ignored', async () => {
  assertEquals(await readDeliveryReport(await urlFor(7), form({ MessageSid: 'SM123', MessageStatus: 'sent' }), secret), { kind: 'ignored' });
});

Deno.test('a wrong token, or the token of another message, is refused', async () => {
  const delivered = form({ MessageSid: 'SM123', MessageStatus: 'delivered' });
  const other = await urlFor(8);
  other.searchParams.set('message', '7');
  assertEquals(await readDeliveryReport(other, delivered, secret), null);
  assertEquals(await readDeliveryReport(await urlFor(7), delivered, 'another-secret'), null);
  assertEquals(await readDeliveryReport(new URL('https://barry.example/functions/v1/deliver/status'), delivered, secret), null);
});

Deno.test('without DELIVER_SECRET every report is refused', async () => {
  const delivered = form({ MessageSid: 'SM123', MessageStatus: 'delivered' });
  assertEquals(await readDeliveryReport(await urlFor(7), delivered, undefined), null);
  assertEquals(await readDeliveryReport(await urlFor(7), delivered, ''), null);
});
