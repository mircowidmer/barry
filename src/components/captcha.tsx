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
  /** The build has a key, so every request needs a token from the widget. */
  required: boolean;
  token: string | undefined;
  renew: () => void;
};

/**
 * Cloudflare Turnstile for the requests Supabase Auth guards with a captcha: sign-in, sign-up and the recovery
 * email. A token works once, so renew() after every request brings a fresh widget. onToken hears each new token, with renew() for when it takes the token.
 */
export function useCaptcha(onToken?: (token: string, renew: () => void) => void): Captcha {
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const renew = () => {
    setToken(null);
    setRound((n) => n + 1);
  };
  return {
    widget: SITE_KEY && (
      <WebView
        key={round}
        source={{ html: turnstilePage(SITE_KEY), baseUrl: SITE }}
        // Turnstile renders its challenge in about:srcdoc frames, which the default list blocks.
        originWhitelist={['https://*', 'about:srcdoc']}
        onMessage={(event) => {
          const received = turnstileToken(event.nativeEvent.data);
          setToken(received);
          if (received !== null) onToken?.(received, renew);
        }}
        style={styles.widget}
        scrollEnabled={false}
      />
    ),
    ready: SITE_KEY === null || token !== null,
    required: SITE_KEY !== null,
    token: token ?? undefined,
    renew,
  };
}

const styles = StyleSheet.create({
  // Turnstile's widget is 65 points high.
  widget: { height: 70, backgroundColor: 'transparent' },
});
