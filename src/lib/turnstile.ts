/**
 * The page the app shows Cloudflare Turnstile in. It says it comes from barry.support, the hostname the widget is
 * registered for, and posts each token, or its loss, back to the app.
 */
export const turnstilePage = (siteKey: string): string => `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=render&render=explicit" async defer></script>
<style>html, body { margin: 0; background: transparent; } body { display: flex; justify-content: center; }</style>
</head>
<body>
<div id="widget"></div>
<script>
  const post = (token) => window.ReactNativeWebView.postMessage(JSON.stringify({ token }));
  function render() {
    turnstile.render('#widget', {
      sitekey: ${JSON.stringify(siteKey)},
      callback: (token) => post(token),
      'expired-callback': () => post(null),
      'error-callback': () => post(null),
    });
  }
</script>
</body>
</html>`;

/** The captcha part of a Supabase Auth call's options, for a build with a token and one without alike. */
export const captchaOptions = (token: string | undefined): { captchaToken?: string } => (token === undefined ? {} : { captchaToken: token });

/** The token in a message from the page, or null for a lost token or a message that is not one. */
export const turnstileToken = (data: string): string | null => {
  try {
    const { token } = JSON.parse(data) as { token?: unknown };
    return typeof token === 'string' && token !== '' ? token : null;
  } catch {
    return null;
  }
};
