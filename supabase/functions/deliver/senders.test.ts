import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { linkMobilitySms, resendEmail } from './senders.ts';

const message = { subject: 'Anna is back safe', text: 'Anna checked in safely at Sat 17 Oct, 19:05.' };

const resend = { apiUrl: 'http://resend.test', apiKey: 're_test', from: 'barry@example.com' };

const resendAnswering = async (status: number, reply: unknown) => {
  const realFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = (input, init) => {
    request = new Request(input, init);
    return Promise.resolve(new Response(JSON.stringify(reply), { status }));
  };
  try {
    const result = await resendEmail(() => resend)('luca@example.com', message, 7);
    return { result, request: request! };
  } finally {
    globalThis.fetch = realFetch;
  }
};

Deno.test('an email goes to Resend as JSON with a Bearer key and one idempotency key per message', async () => {
  const { result, request } = await resendAnswering(200, { id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' });
  assertEquals(result, { outcome: 'sent', providerRef: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' });
  assertEquals(request.method, 'POST');
  assertEquals(request.url, 'http://resend.test/emails');
  assertEquals(request.headers.get('authorization'), 'Bearer re_test');
  assertEquals(request.headers.get('idempotency-key'), 'barry-message-7');
  assertEquals(await request.json(), {
    from: 'Barry <barry@example.com>',
    to: ['luca@example.com'],
    subject: 'Anna is back safe',
    text: 'Anna checked in safely at Sat 17 Oct, 19:05.',
  });
});

Deno.test('an unverified domain fails with the Resend error name and message', async () => {
  const { result } = await resendAnswering(403, { statusCode: 403, name: 'validation_error', message: 'The example.com domain is not verified.' });
  assertEquals(result, { outcome: 'failed', reason: 'HTTP 403: Resend validation_error: The example.com domain is not verified.' });
});

Deno.test('Resend rate limiting and outages are retried', async () => {
  assertEquals((await resendAnswering(429, { name: 'rate_limit_exceeded', message: 'Too many requests' })).result, {
    outcome: 'retry',
    reason: 'HTTP 429: Resend rate_limit_exceeded: Too many requests',
  });
  assertEquals((await resendAnswering(500, 'internal')).result.outcome, 'retry');
});

const linkMobility = { apiUrl: 'http://linkmobility.test', accessToken: 'lm-token', sender: 'Barry' };

const linkMobilityAnswering = async (status: number, reply: unknown, sender = linkMobility.sender) => {
  const realFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = (input, init) => {
    request = new Request(input, init);
    return Promise.resolve(new Response(JSON.stringify(reply), { status }));
  };
  try {
    const result = await linkMobilitySms(() => ({ ...linkMobility, sender }))('+41792222222', message, 7);
    return { result, request: request! };
  } finally {
    globalThis.fetch = realFetch;
  }
};

Deno.test('a text message goes to LINK Mobility from the alphanumeric sender, and its transfer id becomes the provider ref', async () => {
  const { result, request } = await linkMobilityAnswering(200, { statusCode: 2000, statusMessage: 'OK', transferId: '0059d0b20100a0a8b803', smsCount: 1 });
  assertEquals(result, { outcome: 'sent', providerRef: '0059d0b20100a0a8b803' });
  assertEquals(request.method, 'POST');
  assertEquals(request.url, 'http://linkmobility.test/rest/smsmessaging/text');
  assertEquals(request.headers.get('authorization'), 'Bearer lm-token');
  assertEquals(await request.json(), {
    recipientAddressList: ['41792222222'],
    messageContent: 'Anna checked in safely at Sat 17 Oct, 19:05.',
    senderAddress: 'Barry',
    senderAddressType: 'alphanumeric',
    contentCategory: 'informational',
    clientMessageId: 'barry-message-7',
  });
});

Deno.test('a phone number as the sender goes out as an international sender', async () => {
  const { request } = await linkMobilityAnswering(200, { statusCode: 2001, statusMessage: 'OK_QUEUED', transferId: 'q1' }, '+41445551234');
  const body = await request.json();
  assertEquals([body.senderAddress, body.senderAddressType], ['41445551234', 'international']);
});

Deno.test('a refused recipient fails with LINK Mobility\'s status, and throttling is retried', async () => {
  assertEquals((await linkMobilityAnswering(200, { statusCode: 4002, statusMessage: 'INVALID_RECIPIENT' })).result, {
    outcome: 'failed',
    reason: 'LINK Mobility 4002: INVALID_RECIPIENT',
  });
  assertEquals((await linkMobilityAnswering(200, { statusCode: 4025, statusMessage: 'THROTTLING' })).result, {
    outcome: 'retry',
    reason: 'LINK Mobility 4025: THROTTLING',
  });
});

Deno.test('a wrong access token fails, and a LINK Mobility outage is retried', async () => {
  assertEquals((await linkMobilityAnswering(401, {})).result, { outcome: 'failed', reason: 'HTTP 401: LINK Mobility refused the access token' });
  assertEquals((await linkMobilityAnswering(503, 'unavailable')).result.outcome, 'retry');
});
