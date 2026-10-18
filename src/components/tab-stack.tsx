import { Stack } from 'expo-router';

/**
 * The navigator of one tab. Its first screen carries the tab's name as a large title, and a screen
 * pushed on top keeps the tab bar, as iOS expects, and sets its own title.
 */
export function TabStack({ title }: { title: string }) {
  return (
    <Stack screenOptions={{ title }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true }} />
    </Stack>
  );
}
