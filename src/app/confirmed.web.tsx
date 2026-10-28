import { useEffect, useSyncExternalStore } from 'react';

import { SitePage } from '@/components/site-page';
import { type Confirmed, confirmationError, confirmedWhat, linkSession, revokeLinkSession, withoutFragment } from '@/lib/confirmation';
import { siteText, useSiteLanguage } from '@/lib/site-language';

export const generateMetadata = () => ({ title: 'Barry', robots: { index: false, follow: false } });

type Landing = { error: string } | { confirmed: Confirmed };

// The address the link opened, read once: the page then clears its fragment, which must not change what it says.
const landedAt = typeof location === 'undefined' ? null : location.href;

const revoke = revokeLinkSession(
  (input, init) => fetch(input, init),
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
);

// The snapshot is the address itself: a string compares equal between renders, while a fresh object
// each time makes React render without end.
const landingAt = (href: string | null): Landing => {
  if (href === null) return { confirmed: 'account' };
  const error = confirmationError(href);
  return error ? { error } : { confirmed: confirmedWhat(href) };
};

export default function ConfirmedRoute() {
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
        <p className="note">{landing.error}.</p>
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
