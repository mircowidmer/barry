import { NativeTabs } from 'expo-router/native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useTexts } from '@/lib/texts';

// Liquid Glass picks the tab bar's light or dark look from the content behind it, so iOS gets both
// accent colours and chooses. The bar's background is the system's own and cannot be set.
const tint = Platform.OS === 'ios' ? DynamicColorIOS({ light: Colors.light.accent, dark: Colors.dark.accent }) : Colors.light.accent;

export default function AppTabs() {
  const t = useTexts();

  return (
    <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown">
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
