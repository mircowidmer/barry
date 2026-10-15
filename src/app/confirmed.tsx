import { useSyncExternalStore } from 'react';

import { Notice, Screen } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { confirmationError } from '@/lib/confirmation';

export const generateMetadata = () => ({ title: 'Barry', robots: { index: false, follow: false } });

export default function ConfirmedRoute() {
  const error = useSyncExternalStore(
    () => () => undefined,
    () => (typeof location === 'undefined' ? null : confirmationError(location.href)),
    () => null,
  );

  return error ? (
    <Screen title="This link did not work">
      <Notice tone="warning">{error}.</Notice>
      <ThemedText>Open Barry and tap Create account again to get a new link.</ThemedText>
    </Screen>
  ) : (
    <Screen title="Your email is confirmed">
      <ThemedText>Go back to Barry and sign in.</ThemedText>
    </Screen>
  );
}
