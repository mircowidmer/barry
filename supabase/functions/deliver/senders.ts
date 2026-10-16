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

const parseJson = (body: string): Record<string, unknown> => {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
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

export const senders: Record<Channel, Sender> = {
  email: (to, message, messageId) => (Deno.env.get('RESEND_API_KEY') ? resend : mailpitEmail)(to, message, messageId),
  // The sms channel stays off in channel_config until a provider is added, so no text message reaches here.
  sms: () => Promise.resolve({ outcome: 'failed', reason: 'No text message provider is set up' }),
  push: expoPush,
};
