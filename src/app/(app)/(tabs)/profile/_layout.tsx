import { Stack } from 'expo-router';

import { TabStack } from '@/components/tab-stack';
import { useTexts } from '@/lib/texts';

export default function ProfileLayout() {
  const t = useTexts();
  return (
    <TabStack title={t.profile.title}>
      <Stack.Screen name="account" options={{ title: t.account.title, presentation: 'modal' }} />
      <Stack.Screen name="about" options={{ title: t.profile.about, presentation: 'modal' }} />
      <Stack.Screen name="car" options={{ title: t.profile.car }} />
      <Stack.Screen name="medical" options={{ title: t.profile.medical }} />
    </TabStack>
  );
}
