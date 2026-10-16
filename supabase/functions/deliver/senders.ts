import type { Channel } from './facts.ts';
import type { Rendered } from './messages.en.ts';

export type SendResult =
  | { outcome: 'sent'; providerRef: string | null }
  | { outcome: 'retry'; reason: string; retryAfterSeconds?: number }
  | { outcome: 'failed'; reason: string };

export type Sender = (to: string, message: Rendered, messageId: number) => Promise<SendResult>;

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const fromHttpStatus = (status: number, detail: string): SendResult =>
  status === 429 || status >= 500
    ? { outcome: 'retry', reason: `HTTP ${status}: ${detail}` }
    : { outcome: 'failed', reason: `HTTP ${status}: ${detail}` };

// Mailpit's send API, for local development.
const mailpitEmail: Sender = async (to, message, messageId) => {
  const response = await fetch(env('EMAIL_API_URL'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      From: { Email: env('EMAIL_FROM'), Name: 'Barry' },
      To: [{ Email: to }],
      Subject: message.subject,
      Text: message.text,
      Headers: { 'X-Barry-Message-Id': String(messageId) },
    }),
  });
  const body = await response.text();
  if (!response.ok) return fromHttpStatus(response.status, body.slice(0, 200));
  return { outcome: 'sent', providerRef: (JSON.parse(body) as { ID?: string }).ID ?? null };
};

const expoPush: Sender = async (to, message) => {
  const response = await fetch(Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ to, title: message.subject, body: message.text, sound: 'default', priority: 'high' }),
  });
  const body = await response.text();
  if (!response.ok) return fromHttpStatus(response.status, body.slice(0, 200));
  const ticket = (JSON.parse(body) as { data?: { status: string; id?: string; message?: string; details?: { error?: string } } }).data;
  if (ticket?.status === 'ok') return { outcome: 'sent', providerRef: ticket.id ?? null };
  const reason = ticket?.details?.error ?? ticket?.message ?? 'unknown Expo error';
  return reason === 'MessageRateExceeded' ? { outcome: 'retry', reason } : { outcome: 'failed', reason };
};

export type TwilioConfig = { apiUrl: string; accountSid: string; authToken: string; from: string };

const parseJson = (body: string): Record<string, unknown> => {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

export const twilioSms = (config: () => TwilioConfig): Sender => async (to, message) => {
  const { apiUrl, accountSid, authToken, from } = config();
  const response = await fetch(`${apiUrl}/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
    body: new URLSearchParams({ To: to, From: from, Body: message.text }),
  });
  const body = parseJson(await response.text());
  if (!response.ok) return fromHttpStatus(response.status, `Twilio ${body.code ?? 'error'}: ${body.message ?? response.statusText}`);
  return { outcome: 'sent', providerRef: typeof body.sid === 'string' ? body.sid : null };
};

export type AcsConfig = { endpoint: string; accessKey: string; from: string; now?: () => Date };

export const parseAcsConnectionString = (value: string): { endpoint: string; accessKey: string } => {
  const parts = Object.fromEntries(
    value
      .split(';')
      .filter((part) => part.includes('='))
      .map((part) => [part.slice(0, part.indexOf('=')).trim().toLowerCase(), part.slice(part.indexOf('=') + 1).trim()]),
  );
  if (!parts.endpoint || !parts.accesskey) throw new Error('ACS_CONNECTION_STRING needs endpoint=... and accesskey=...');
  return { endpoint: parts.endpoint.replace(/\/+$/, ''), accessKey: parts.accesskey };
};

const base64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

// Azure Communication Services' access-key scheme: an HMAC-SHA256 over the method, path, date, host and body hash.
export const acsAuthHeaders = async (url: URL, body: string, accessKey: string, date: string) => {
  const contentHash = base64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)));
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(atob(accessKey), (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = `POST\n${url.pathname}${url.search}\n${date};${url.host};${contentHash}`;
  const signature = base64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed)));
  return {
    'x-ms-date': date,
    'x-ms-content-sha256': contentHash,
    authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
};

type AcsResult = { successful?: boolean; messageId?: string; httpStatusCode?: number; errorMessage?: string };

export const acsSms = (config: () => AcsConfig): Sender => async (to, message) => {
  const { endpoint, accessKey, from, now = () => new Date() } = config();
  const url = new URL(`${endpoint}/sms?api-version=2021-03-07`);
  const body = JSON.stringify({ from, smsRecipients: [{ to }], message: message.text });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await acsAuthHeaders(url, body, accessKey, now().toUTCString())) },
    body,
  });
  const reply = parseJson(await response.text());
  if (!response.ok) {
    const error = reply.error as { code?: string; message?: string } | undefined;
    return fromHttpStatus(response.status, `Azure ${error?.code ?? 'error'}: ${error?.message ?? response.statusText}`);
  }
  const [result] = (reply.value as AcsResult[] | undefined) ?? [];
  if (result?.successful) return { outcome: 'sent', providerRef: result.messageId ?? null };
  return fromHttpStatus(result?.httpStatusCode ?? 502, `Azure: ${result?.errorMessage ?? 'no result for the recipient'}`);
};

export type ResendConfig = { apiUrl: string; apiKey: string; from: string };

// The idempotency key is per message, so a retry after a lost response never sends a second email.
export const resendEmail = (config: () => ResendConfig): Sender => async (to, message, messageId) => {
  const { apiUrl, apiKey, from } = config();
  const response = await fetch(`${apiUrl}/emails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `barry-message-${messageId}`,
    },
    body: JSON.stringify({ from: `Barry <${from}>`, to: [to], subject: message.subject, text: message.text }),
  });
  const body = parseJson(await response.text());
  if (!response.ok) return fromHttpStatus(response.status, `Resend ${body.name ?? 'error'}: ${body.message ?? response.statusText}`);
  return { outcome: 'sent', providerRef: typeof body.id === 'string' ? body.id : null };
};

const resend = resendEmail(() => ({
  apiUrl: Deno.env.get('RESEND_API_URL') ?? 'https://api.resend.com',
  apiKey: env('RESEND_API_KEY'),
  from: env('EMAIL_FROM'),
}));

const twilio = twilioSms(() => ({
  apiUrl: Deno.env.get('TWILIO_API_URL') ?? 'https://api.twilio.com',
  accountSid: env('TWILIO_ACCOUNT_SID'),
  authToken: env('TWILIO_AUTH_TOKEN'),
  from: env('TWILIO_FROM'),
}));

const acs = acsSms(() => ({ ...parseAcsConnectionString(env('ACS_CONNECTION_STRING')), from: env('ACS_SMS_FROM') }));

export const senders: Record<Channel, Sender> = {
  email: (to, message, messageId) => (Deno.env.get('RESEND_API_KEY') ? resend : mailpitEmail)(to, message, messageId),
  sms: (to, message, messageId) => (Deno.env.get('ACS_CONNECTION_STRING') ? acs : twilio)(to, message, messageId),
  push: expoPush,
};
