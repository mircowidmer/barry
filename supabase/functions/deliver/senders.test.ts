import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { acsSms, parseAcsConnectionString, resendEmail, twilioSms } from './senders.ts';

const config = { apiUrl: 'http://twilio.test', accountSid: 'ACtest', authToken: 'secret', from: 'Barry' };
const message = { subject: 'Anna is back safe', text: 'Anna checked in safely at Sat 17 Oct, 19:05.' };

const answering = async (status: number, reply: unknown) => {
  const realFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = (input, init) => {
    request = new Request(input, init);
    return Promise.resolve(new Response(JSON.stringify(reply), { status }));
  };
  try {
    const result = await twilioSms(() => config)('+41792222222', message, 7);
    return { result, request: request! };
  } finally {
    globalThis.fetch = realFetch;
  }
};

Deno.test('a text message goes to Twilio as a form with Basic auth, and its sid becomes the provider ref', async () => {
  const { result, request } = await answering(201, { sid: 'SM123', status: 'queued' });
  assertEquals(result, { outcome: 'sent', providerRef: 'SM123' });
  assertEquals(request.method, 'POST');
  assertEquals(request.url, 'http://twilio.test/2010-04-01/Accounts/ACtest/Messages.json');
  assertEquals(request.headers.get('authorization'), `Basic ${btoa('ACtest:secret')}`);
  assertEquals(Object.fromEntries(new URLSearchParams(await request.text())), {
    To: '+41792222222',
    From: 'Barry',
    Body: 'Anna checked in safely at Sat 17 Oct, 19:05.',
  });
});

Deno.test('a rejected number fails with the Twilio error code and message', async () => {
  const { result } = await answering(400, { code: 21211, message: "The 'To' number is not a valid phone number." });
  assertEquals(result, { outcome: 'failed', reason: "HTTP 400: Twilio 21211: The 'To' number is not a valid phone number." });
});

Deno.test('rate limiting and Twilio outages are retried', async () => {
  assertEquals((await answering(429, { code: 20429, message: 'Too Many Requests' })).result, {
    outcome: 'retry',
    reason: 'HTTP 429: Twilio 20429: Too Many Requests',
  });
  assertEquals((await answering(503, 'unavailable')).result.outcome, 'retry');
});

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

const acs = {
  endpoint: 'https://barry.communication.azure.com',
  accessKey: 'YmFycnktdGVzdC1hY2Nlc3Mta2V5LTAxMjM0NTY3ODk=',
  from: 'Barry',
  now: () => new Date('2026-10-17T17:05:00Z'),
};

const answeringAcs = async (status: number, reply: unknown) => {
  const realFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = (input, init) => {
    request = new Request(input, init);
    return Promise.resolve(new Response(JSON.stringify(reply), { status }));
  };
  try {
    const result = await acsSms(() => acs)('+41792222222', message, 7);
    return { result, request: request! };
  } finally {
    globalThis.fetch = realFetch;
  }
};

const accepted = (item: Record<string, unknown>) => ({ value: [{ to: '+41792222222', ...item }] });

Deno.test('a text message goes to Azure signed with the access key, and its message id becomes the provider ref', async () => {
  const { result, request } = await answeringAcs(202, accepted({ messageId: 'Outgoing_1', httpStatusCode: 202, successful: true }));
  assertEquals(result, { outcome: 'sent', providerRef: 'Outgoing_1' });
  assertEquals(request.url, 'https://barry.communication.azure.com/sms?api-version=2021-03-07');
  assertEquals(await request.json(), {
    from: 'Barry',
    smsRecipients: [{ to: '+41792222222' }],
    message: 'Anna checked in safely at Sat 17 Oct, 19:05.',
  });
  assertEquals(request.headers.get('x-ms-date'), 'Sat, 17 Oct 2026 17:05:00 GMT');
  assertEquals(request.headers.get('x-ms-content-sha256'), 'Z0yhLPZDGUady+Ybnl0SrEKhNcYekNtSNLVLiBFcRh0=');
  assertEquals(
    request.headers.get('authorization'),
    'HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=EFxpoCMcIkQngjSEEEknd5cw/pxTJz8PscIwUR8nJf0=',
  );
});

Deno.test('a recipient Azure refuses fails with its error, and a busy one is retried', async () => {
  assertEquals((await answeringAcs(202, accepted({ httpStatusCode: 400, errorMessage: 'Invalid To phone number format.', successful: false }))).result, {
    outcome: 'failed',
    reason: 'HTTP 400: Azure: Invalid To phone number format.',
  });
  assertEquals((await answeringAcs(202, accepted({ httpStatusCode: 503, errorMessage: 'ServiceUnavailable', successful: false }))).result, {
    outcome: 'retry',
    reason: 'HTTP 503: Azure: ServiceUnavailable',
  });
});

Deno.test('a rejected request fails with the Azure error, and throttling is retried', async () => {
  assertEquals((await answeringAcs(401, { error: { code: 'Denied', message: 'Denied by the resource provider.' } })).result, {
    outcome: 'failed',
    reason: 'HTTP 401: Azure Denied: Denied by the resource provider.',
  });
  assertEquals((await answeringAcs(429, { error: { code: 'TooManyRequests', message: 'Throttled.' } })).result.outcome, 'retry');
});

Deno.test('the connection string from the Azure portal gives the endpoint and the access key', () => {
  assertEquals(
    parseAcsConnectionString('endpoint=https://barry.communication.azure.com/;accesskey=YmFycnktdGVzdC1hY2Nlc3Mta2V5LTAxMjM0NTY3ODk='),
    { endpoint: 'https://barry.communication.azure.com', accessKey: 'YmFycnktdGVzdC1hY2Nlc3Mta2V5LTAxMjM0NTY3ODk=' },
  );
});
