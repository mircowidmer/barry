import { Stack } from 'expo-router';

import { TabStack } from '@/components/tab-stack';
import { useTexts } from '@/lib/texts';

export default function ProfileLayout() {
  const t = useTexts();
  return (
    <TabStack title={t.profile.title}>
      <Stack.Screen name="account" options={{ title: t.account.title }} />
    </TabStack>
  );
}
