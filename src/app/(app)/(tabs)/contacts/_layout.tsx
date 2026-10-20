import { Stack } from 'expo-router';

import { TabStack } from '@/components/tab-stack';
import { useTexts } from '@/lib/texts';

export default function ContactsLayout() {
  return (
    <TabStack title={useTexts().contacts.title}>
      <Stack.Screen name="[id]" options={{ presentation: 'modal' }} />
    </TabStack>
  );
}
