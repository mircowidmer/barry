import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

/**
 * The navigator of one tab. Its first screen carries the tab's name as a large title, and a screen
 * pushed on top keeps the tab bar, as iOS expects, and sets its own title. The children declare
 * the tab's other screens, such as a sheet.
 */
export function TabStack({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack screenOptions={{ title }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true }} />
      {children}
    </Stack>
  );
}
