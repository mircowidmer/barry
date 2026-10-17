import { reportUrl } from './delivery-report.ts';
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
      From: { Email: env('EMAIL_FROM'), Name: '🐶 Barry' },
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
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
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

const parseJson = (body: string): Record<string, unknown> => {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

// An API key restricted to creating messages signs the request; the Account SID only names the account in the path.
export type TwilioConfig = {
  apiUrl: string;
  accountSid: string;
  keySid: string;
  keySecret: string;
  from: string;
  statusCallback?: (messageId: number) => Promise<string>;
};

export const twilioSms = (config: () => TwilioConfig): Sender => async (to, message, messageId) => {
  const { apiUrl, accountSid, keySid, keySecret, from, statusCallback } = config();
  const form = new URLSearchParams({ To: to, From: from, Body: message.text });
  if (statusCallback) form.set('StatusCallback', await statusCallback(messageId));
  const response = await fetch(`${apiUrl}/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${keySid}:${keySecret}`)}` },
    body: form,
  });
  const body = parseJson(await response.text());
  if (!response.ok) return fromHttpStatus(response.status, `Twilio ${body.code ?? 'error'}: ${body.message ?? response.statusText}`);
  return { outcome: 'sent', providerRef: typeof body.sid === 'string' ? body.sid : null };
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
    body: JSON.stringify({ from: `🐶 Barry <${from}>`, to: [to], subject: message.subject, text: message.text }),
  });
  const body = parseJson(await response.text());
  if (!response.ok) return fromHttpStatus(response.status, `Resend ${body.name ?? 'error'}: ${body.message ?? response.statusText}`);
  return { outcome: 'sent', providerRef: typeof body.id === 'string' ? body.id : null };
};

const resend = resendEmail(() => ({
  apiUrl: 'https://api.resend.com',
  apiKey: env('RESEND_API_KEY'),
  from: env('EMAIL_FROM'),
}));

const twilio = twilioSms(() => ({
  apiUrl: Deno.env.get('TWILIO_API_URL') ?? 'https://api.twilio.com',
  accountSid: env('TWILIO_ACCOUNT_SID'),
  keySid: env('TWILIO_API_KEY_SID'),
  keySecret: env('TWILIO_API_KEY_SECRET'),
  from: env('TWILIO_FROM'),
  statusCallback: (messageId) => reportUrl(env('SUPABASE_URL'), env('DELIVER_SECRET'), messageId),
}));

export const senders: Record<Channel, Sender> = {
  email: (to, message, messageId) => (Deno.env.get('RESEND_API_KEY') ? resend : mailpitEmail)(to, message, messageId),
  sms: (to, message, messageId) =>
    Deno.env.get('TWILIO_ACCOUNT_SID')
      ? twilio(to, message, messageId)
      : Promise.resolve({ outcome: 'failed', reason: 'TWILIO_ACCOUNT_SID is not set' }),
  push: expoPush,
};
