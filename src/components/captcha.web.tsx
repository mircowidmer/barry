// The web build has no sign-in, so it needs no captcha.
export function useCaptcha() {
  return { widget: null, ready: true, token: undefined, renew: () => undefined };
}
