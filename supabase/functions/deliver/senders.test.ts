import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { resendEmail } from './senders.ts';

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
