import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { loadToolbarIcons } from '@/components/symbol';

export default function RootLayout() {
  // A toolbar rendered before its icons on Android would show no Save or Cancel button.
  const [ready, setReady] = useState(Platform.OS !== 'android');
  useEffect(() => {
    if (!ready) void loadToolbarIcons().finally(() => setReady(true));
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
