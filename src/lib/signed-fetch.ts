/**
 * When a token refresh fails, for example the moment the signal returns, supabase-js sends the next
 * request with the publishable key instead of the Adventurer's token, and the database refuses it with
 * "permission denied". Failing such a request like a lost signal lets the screens fall back and retry.
 */
export const signedOnly =
  (fetchFn: typeof fetch, publishableKey: string): typeof fetch =>
  (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const toDatabase = url.includes('/rest/v1/') || url.includes('/functions/v1/');
    // Like fetch itself: headers in init replace a Request's own.
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const unsigned = headers.get('Authorization') === `Bearer ${publishableKey}`;
    if (toDatabase && unsigned) return Promise.reject(new TypeError('Network request failed: no session token'));
    return fetchFn(input, init);
  };
