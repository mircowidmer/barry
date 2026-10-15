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

// Mailpit's send API locally. A hosted email provider replaces this sender, not its callers.
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

export const smsBody = (message: Rendered): string => `${message.subject}\n\n${message.text}`;

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
    body: new URLSearchParams({ To: to, From: from, Body: smsBody(message) }),
  });
  const body = parseJson(await response.text());
  if (!response.ok) return fromHttpStatus(response.status, `Twilio ${body.code ?? 'error'}: ${body.message ?? response.statusText}`);
  return { outcome: 'sent', providerRef: typeof body.sid === 'string' ? body.sid : null };
};

export const senders: Record<Channel, Sender> = {
  email: mailpitEmail,
  sms: twilioSms(() => ({
    apiUrl: Deno.env.get('TWILIO_API_URL') ?? 'https://api.twilio.com',
    accountSid: env('TWILIO_ACCOUNT_SID'),
    authToken: env('TWILIO_AUTH_TOKEN'),
    from: env('TWILIO_FROM'),
  })),
  push: expoPush,
};
