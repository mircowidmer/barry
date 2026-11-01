import type { Captcha } from './captcha';

export type { Captcha } from './captcha';

// The web build has no sign-in, so it needs no captcha, and nobody is told about a token.
export function useCaptcha(_onToken?: (token: string, renew: () => void) => void): Captcha {
  return { widget: null, ready: true, required: false, token: undefined, renew: () => undefined };
}
