import { useSyncExternalStore } from 'react';

import { SitePage } from '@/components/site-page';
import { confirmationError } from '@/lib/confirmation';

export const generateMetadata = () => ({ title: 'Barry', robots: { index: false, follow: false } });

export default function ConfirmedRoute() {
  const error = useSyncExternalStore(
    () => () => undefined,
    () => confirmationError(location.href),
    () => null,
  );

  return error ? (
    <SitePage title="This link did not work">
      <p className="note">{error}.</p>
      <div className="card">
        <p>Open Barry and tap Create account again to get a new link.</p>
      </div>
    </SitePage>
  ) : (
    <SitePage title="Your email is confirmed" lead="Welcome to Barry. Go alone, get home.">
      <div className="card">
        <p>Open Barry on your iPhone and sign in with your email and password.</p>
        <a className="button" href="barry://sign-in">
          Open Barry and sign in
        </a>
      </div>
    </SitePage>
  );
}
