import { useLastNotificationResponse } from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type AdventureId, barry } from '@/lib/barry';
import { askForNotifications } from '@/lib/notifications';
import { SessionProvider, useSession } from '@/lib/session';
import { tellAboutChangedTerms } from '@/lib/terms-notice';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ fade: true, duration: 300 });

function Navigation() {
  const { session, loading } = useSession();

  useEffect(() => {
    if (!session) return;
    const catchUp = () => {
      barry
        .flushPendingCheckIns()
        .catch(() => undefined)
        .then(() => barry.trail.sync())
        .catch(() => undefined);
      barry.noticeDeliveryFailures().catch(() => undefined);
      barry.syncMessageLanguage().catch(() => undefined);
      askForNotifications().catch(() => undefined);
      tellAboutChangedTerms(async () => (await barry.getInProgressAdventure()).adventure !== null).catch(() => undefined);
    };
    catchUp();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && catchUp());
    return () => subscription.remove();
  }, [session]);

  useEffect(() => (session ? barry.watchDeliveryFailures() : undefined), [session]);

  // A tapped Delivery Failure opens the contacts sheet while the Adventure is in progress, and the Ended Adventure after.
  const response = useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const adventureId = response?.notification.request.content.data?.deliveryFailureOf as AdventureId | undefined;
    const identifier = response?.notification.request.identifier ?? null;
    if (!session || !adventureId || handled.current === identifier) return;
    handled.current = identifier;
    void barry
      .getInProgressAdventure()
      .catch(() => ({ adventure: null }))
      .then(({ adventure }) =>
        router.push({ pathname: adventure?.id === adventureId ? '/watching' : '/history/[id]', params: { id: adventureId } }),
      );
  }, [response, session]);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => undefined);
  }, [loading]);

  if (loading) return null;

  // Each tab has its own stack with the headers, so this one shows none.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      {/* Unguarded: the recovery code signs the Adventurer in before the new password is saved, and the screen must outlive that. */}
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

// Headers, sheets and screens take Barry's colours instead of the navigation library's white and grey. Titles take
// Barry's font in each tab's stack; back buttons keep the system font.
const navigationTheme = (scheme: 'light' | 'dark') => {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.backgroundSelected,
    },
  };
};

const navigationThemes = { light: navigationTheme('light'), dark: navigationTheme('dark') };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={navigationThemes[colorScheme === 'dark' ? 'dark' : 'light']}>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </ThemeProvider>
  );
}
