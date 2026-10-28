import type { Captcha } from './captcha';

// The web build has no sign-in, so it needs no captcha.
export function useCaptcha(): Captcha {
  return { widget: null, ready: true, required: false, token: undefined, renew: () => undefined };
}
