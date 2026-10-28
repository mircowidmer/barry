import { type ReactNode, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { SITE } from '@/lib/site';
import { turnstilePage, turnstileToken } from '@/lib/turnstile';

// Set for the cloud builds only. The local stack asks for no captcha, so a build without a key shows none.
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || null;

export type Captcha = {
  widget: ReactNode;
  /** A token is in hand, or the build has no key and needs none. */
  ready: boolean;
  token: string | undefined;
  renew: () => void;
};

/**
 * Cloudflare Turnstile for the requests Supabase Auth guards with a captcha: sign-in, sign-up and the recovery
 * email. A token works once, so renew() after every request brings a fresh widget.
 */
export function useCaptcha(): Captcha {
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  return {
    widget: SITE_KEY && (
      <WebView
        key={round}
        source={{ html: turnstilePage(SITE_KEY), baseUrl: SITE }}
        onMessage={(event) => setToken(turnstileToken(event.nativeEvent.data))}
        style={styles.widget}
        scrollEnabled={false}
      />
    ),
    ready: SITE_KEY === null || token !== null,
    token: token ?? undefined,
    renew: () => {
      setToken(null);
      setRound((n) => n + 1);
    },
  };
}

const styles = StyleSheet.create({
  // Turnstile's widget is 65 points high.
  widget: { height: 70, backgroundColor: 'transparent' },
});
