import { assertEquals } from '@std/assert';

import { resendEmail, twilioSms } from './senders.ts';

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
    from: '🐶 Barry <barry@example.com>',
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

const twilio = { apiUrl: 'http://twilio.test', accountSid: 'ACtest', keySid: 'SKtest', keySecret: 'secret', from: 'Barry' };

const twilioAnswering = async (status: number, reply: unknown) => {
  const realFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = (input, init) => {
    request = new Request(input, init);
    return Promise.resolve(new Response(JSON.stringify(reply), { status }));
  };
  try {
    const result = await twilioSms(() => twilio)('+41792222222', message, 7);
    return { result, request: request! };
  } finally {
    globalThis.fetch = realFetch;
  }
};

Deno.test('a text message goes to Twilio as a form signed with the API key, and its sid becomes the provider ref', async () => {
  const { result, request } = await twilioAnswering(201, { sid: 'SM123', status: 'queued' });
  assertEquals(result, { outcome: 'sent', providerRef: 'SM123' });
  assertEquals(request.method, 'POST');
  assertEquals(request.url, 'http://twilio.test/2010-04-01/Accounts/ACtest/Messages.json');
  assertEquals(request.headers.get('authorization'), `Basic ${btoa('SKtest:secret')}`);
  assertEquals(Object.fromEntries(new URLSearchParams(await request.text())), {
    To: '+41792222222',
    From: 'Barry',
    Body: 'Anna checked in safely at Sat 17 Oct, 19:05.',
  });
});

Deno.test('a text message asks Twilio to report its delivery to the callback URL of that message', async () => {
  const realFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = (input, init) => {
    request = new Request(input, init);
    return Promise.resolve(new Response(JSON.stringify({ sid: 'SM123' }), { status: 201 }));
  };
  try {
    const statusCallback = (messageId: number) => Promise.resolve(`https://barry.example/status?message=${messageId}`);
    await twilioSms(() => ({ ...twilio, statusCallback }))('+41792222222', message, 7);
  } finally {
    globalThis.fetch = realFetch;
  }
  assertEquals(new URLSearchParams(await request!.text()).get('StatusCallback'), 'https://barry.example/status?message=7');
});

Deno.test('a rejected number fails with the Twilio error code and message', async () => {
  const { result } = await twilioAnswering(400, { code: 21211, message: "The 'To' number is not a valid phone number." });
  assertEquals(result, { outcome: 'failed', reason: "HTTP 400: Twilio 21211: The 'To' number is not a valid phone number." });
});

Deno.test('rate limiting and Twilio outages are retried', async () => {
  assertEquals((await twilioAnswering(429, { code: 20429, message: 'Too Many Requests' })).result, {
    outcome: 'retry',
    reason: 'HTTP 429: Twilio 20429: Too Many Requests',
  });
  assertEquals((await twilioAnswering(503, 'unavailable')).result.outcome, 'retry');
});
