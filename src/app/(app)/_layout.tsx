import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

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

  return (
    <Stack>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plan" options={{ title: 'Adventure', headerBackTitle: 'Back' }} />
        <Stack.Screen name="adventure/[id]" options={{ title: 'Adventure', headerBackTitle: 'Back' }} />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </ThemeProvider>
  );
}
