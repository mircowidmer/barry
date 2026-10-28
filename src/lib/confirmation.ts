const params = (href: string) => {
  const url = new URL(href);
  const found = new URLSearchParams(url.hash.slice(1));
  for (const [key, value] of url.searchParams) found.append(key, value);
  return found;
};

/** Why a confirmation link did not work. */
export type LinkFailure = 'expired' | 'failed';

/**
 * Why Supabase redirected from a confirmation link that did not work, or null when it worked. Only its
 * error_code is read: the page shows Barry's own words, never text from the address, which anyone can write.
 */
export const confirmationError = (href: string): LinkFailure | null => {
  const found = params(href);
  if (!found.has('error') && !found.has('error_code')) return null;
  return found.get('error_code') === 'otp_expired' ? 'expired' : 'failed';
};

/**
 * What a working confirmation link confirmed. An address change sends a link to the old and one to
 * the new address: Supabase answers the first with a message that the other is still to open, and
 * the second with the type of the change. Anything else confirmed a new account.
 */
export type Confirmed = 'account' | 'email_change_first' | 'email_change';

export const confirmedWhat = (href: string): Confirmed => {
  const found = params(href);
  if (found.has('message')) return 'email_change_first';
  return found.get('type') === 'email_change' ? 'email_change' : 'account';
};

/** The access token of the session a working link hands this browser, or null. The web page never uses it. */
export const linkSession = (href: string): string | null => params(href).get('access_token');

/**
 * Ends that session on Supabase, so the tokens a link leaves in the browser's address bar and history sign
 * nobody in later. Only this session ends: the Adventurer stays signed in on the phone.
 */
export const revokeLinkSession =
  (fetchFn: typeof fetch, supabaseUrl: string, publishableKey: string) =>
  async (accessToken: string): Promise<void> => {
    await fetchFn(`${supabaseUrl}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
    });
  };

/** The address of the page without its fragment, where a link puts the tokens. */
export const withoutFragment = (href: string): string => {
  const url = new URL(href);
  return url.pathname + url.search;
};
