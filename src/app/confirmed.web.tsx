import { useEffect, useSyncExternalStore } from 'react';

import { SitePage } from '@/components/site-page';
import { type Confirmed, confirmationError, type LinkFailure, confirmedWhat, linkSession, revokeLinkSession, withoutFragment } from '@/lib/confirmation';
import { publishableKey, supabaseUrl } from '@/lib/site-env';
import { siteText, useSiteLanguage } from '@/lib/site-language';

export const generateMetadata = () => ({ title: 'Barry', robots: { index: false, follow: false } });

type Landing = { error: LinkFailure } | { confirmed: Confirmed };

// The address the link opened, read once: the page then clears its fragment, which must not change what it says.
const landedAt = typeof location === 'undefined' ? null : location.href;

const revoke = revokeLinkSession((input, init) => fetch(input, init), supabaseUrl, publishableKey);

const landingAt = (href: string | null): Landing => {
  if (href === null) return { confirmed: 'account' };
  const error = confirmationError(href);
  return error ? { error } : { confirmed: confirmedWhat(href) };
};

export default function ConfirmedRoute() {
  // The snapshot is the address, a string: a fresh Landing object each time would make React render without end.
  const href = useSyncExternalStore(
    () => () => undefined,
    () => landedAt,
    () => null,
  );

  // A working link hands this browser a session. Barry has no use for it here, so it ends, and the tokens
  // leave the address bar and the history.
  useEffect(() => {
    if (landedAt === null) return;
    const token = linkSession(landedAt);
    if (token !== null) revoke(token).catch(() => undefined);
    history.replaceState(null, '', withoutFragment(landedAt));
  }, []);
  const landing = landingAt(href);
  const t = siteText[useSiteLanguage()];

  if ('error' in landing) {
    return (
      <SitePage title={t.linkFailed}>
        <p className="note">{landing.error === 'expired' ? t.linkExpired : t.linkInvalid}</p>
        <div className="card">
          <p>{t.newLink}</p>
        </div>
      </SitePage>
    );
  }
  if (landing.confirmed === 'email_change_first') {
    return (
      <SitePage title={t.oneMoreLink}>
        <div className="card">
          <p>{t.otherAddress}</p>
        </div>
      </SitePage>
    );
  }
  if (landing.confirmed === 'email_change') {
    return (
      <SitePage title={t.emailChanged} lead={t.signInWithNew}>
        <div className="card">
          <p>{t.staysSignedIn}</p>
        </div>
      </SitePage>
    );
  }
  return (
    <SitePage title={t.emailConfirmed} lead={t.welcome}>
      <div className="card">
        <p>{t.signInHint}</p>
        <a className="button" href="barry://sign-in">
          {t.openBarry}
        </a>
      </div>
    </SitePage>
  );
}
