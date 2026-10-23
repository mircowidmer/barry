import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

import { CheckInAccessory } from '@/components/check-in-accessory';
import { Colors } from '@/constants/theme';
import { useCheckInOffer } from '@/lib/live-check-in';
import { useTabBarHidden } from '@/lib/tab-bar';
import { useTexts } from '@/lib/texts';

// Liquid Glass picks the tab bar's light or dark look from the content behind it, so iOS gets both
// accent colours and chooses. The bar's background is the system's own and cannot be set.
const tint = Platform.OS === 'ios' ? DynamicColorIOS({ light: Colors.light.accent, dark: Colors.dark.accent }) : Colors.light.accent;

export default function AppTabs() {
  const t = useTexts();
  const offer = useCheckInOffer();
  const onAdventureTab = (useSegments() as string[]).includes('(adventure)');

  return (
    <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown" hidden={useTabBarHidden()}>
      {/* Like the player in Music, but only on the Adventure tab, which is where the Live Adventure shows. */}
      {offer && onAdventureTab && (
        <NativeTabs.BottomAccessory>
          <CheckInAccessory offer={offer} />
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger name="(adventure)">
        <NativeTabs.Trigger.Label>{t.tabs.adventure}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.hiking" md="hiking" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>{t.tabs.history}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="contacts">
        <NativeTabs.Trigger.Label>{t.tabs.contacts}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t.tabs.profile}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
