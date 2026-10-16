import { useSyncExternalStore } from 'react';

import { SitePage } from '@/components/site-page';
import { confirmationError } from '@/lib/confirmation';
import { siteText, useSiteLanguage } from '@/lib/site-language';

export const generateMetadata = () => ({ title: 'Barry', robots: { index: false, follow: false } });

export default function ConfirmedRoute() {
  const error = useSyncExternalStore(
    () => () => undefined,
    () => confirmationError(location.href),
    () => null,
  );
  const t = siteText[useSiteLanguage()];

  return error ? (
    <SitePage title={t.linkFailed}>
      <p className="note">{error}.</p>
      <div className="card">
        <p>{t.newLink}</p>
      </div>
    </SitePage>
  ) : (
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
