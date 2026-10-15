import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { barry } from '@/lib/barry';
import { registerForPush } from '@/lib/push';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { session, loading } = useSession();

  useEffect(() => {
    if (!session) return;
    barry.flushPendingCheckIns();
    registerForPush();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      barry.flushPendingCheckIns();
      registerForPush();
    });
    return () => subscription.remove();
  }, [session]);

  if (loading) return null;

  return (
    <Stack>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plan" options={{ title: 'Adventure', headerBackTitle: 'Back' }} />
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
        <AnimatedSplashOverlay />
        <Navigation />
      </SessionProvider>
    </ThemeProvider>
  );
}
