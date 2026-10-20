import { useSyncExternalStore } from 'react';

import { SitePage } from '@/components/site-page';
import { type Confirmed, confirmationError, confirmedWhat } from '@/lib/confirmation';
import { siteText, useSiteLanguage } from '@/lib/site-language';

export const generateMetadata = () => ({ title: 'Barry', robots: { index: false, follow: false } });

type Landing = { error: string } | { confirmed: Confirmed };

export default function ConfirmedRoute() {
  const landing = useSyncExternalStore<Landing>(
    () => () => undefined,
    () => {
      const error = confirmationError(location.href);
      return error ? { error } : { confirmed: confirmedWhat(location.href) };
    },
    () => ({ confirmed: 'account' }),
  );
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
