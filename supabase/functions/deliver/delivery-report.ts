import { sameSecret } from './constant-time.ts';

// Twilio signs its status callbacks with the account's Auth Token, which Barry does not hold since it
// sends with a restricted API key. So each callback URL carries a token that only DELIVER_SECRET makes.

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const reportToken = async (secret: string, messageId: number): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`delivery-report:${messageId}`))).slice(0, 32);
};

export const reportUrl = async (base: string, secret: string, messageId: number): Promise<string> =>
  `${base}/functions/v1/deliver/status?message=${messageId}&token=${await reportToken(secret, messageId)}`;

const TWILIO_ERRORS: Record<string, string> = {
  '30003': 'Unreachable destination handset',
  '30004': 'Message blocked',
  '30005': 'Unknown destination handset',
  '30006': 'Landline or unreachable carrier',
  '30007': 'Message filtered by the carrier',
  '30008': 'Unknown error',
};

export type DeliveryReport =
  | { kind: 'ignored' }
  | { kind: 'report'; messageId: number; providerRef: string; status: 'delivered' | 'undelivered' | 'failed'; reason: string | null };

/** Reads one Twilio status callback. Statuses before the final one, such as queued and sent, are ignored. */
export const readDeliveryReport = async (url: URL, form: URLSearchParams, secret: string): Promise<DeliveryReport | null> => {
  const messageId = Number(url.searchParams.get('message'));
  const token = url.searchParams.get('token') ?? '';
  if (!Number.isSafeInteger(messageId) || !sameSecret(token, await reportToken(secret, messageId))) return null;

  const status = form.get('MessageStatus');
  if (status !== 'delivered' && status !== 'undelivered' && status !== 'failed') return { kind: 'ignored' };
  const code = form.get('ErrorCode');
  return {
    kind: 'report',
    messageId,
    providerRef: form.get('MessageSid') ?? '',
    status,
    reason: status === 'delivered' ? null : `Twilio ${code ?? 'error'}: ${(code && TWILIO_ERRORS[code]) ?? status}`,
  };
};
