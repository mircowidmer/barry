import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { twilioSms } from './senders.ts';

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
    Body: 'Anna is back safe\n\nAnna checked in safely at Sat 17 Oct, 19:05.',
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
