import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { barry } from '@/lib/barry';
import { askForNotifications } from '@/lib/notifications';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();
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
      barry.syncMessageLanguage().catch(() => undefined);
      askForNotifications();
    };
    catchUp();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && catchUp());
    return () => subscription.remove();
  }, [session]);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
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

// Headers, sheets and screens take Barry's colours and font instead of the navigation library's white, grey and system font.
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
    fonts: {
      regular: { ...base.fonts.regular, fontFamily: FontFamily },
      medium: { ...base.fonts.medium, fontFamily: FontFamily },
      bold: { ...base.fonts.bold, fontFamily: FontFamily },
      heavy: { ...base.fonts.heavy, fontFamily: FontFamily },
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
