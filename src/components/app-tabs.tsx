import { NativeTabs } from 'expo-router/native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { useTabBarHidden } from '@/lib/tab-bar';
import { useTexts } from '@/lib/texts';

// Liquid Glass picks the tab bar's light or dark look from the content behind it, so iOS gets both
// accent colours and chooses. The bar's background is the system's own and cannot be set.
const tint = Platform.OS === 'ios' ? DynamicColorIOS({ light: Colors.light.accent, dark: Colors.dark.accent }) : Colors.light.accent;

// A label with only a font family falls back to React Native's 14 pt, which makes every item and the bar
// larger than the system's. 10 pt is the label size of the system tab bar, as in Music on iOS 27.
const labelStyle = { fontFamily: FontFamily, fontSize: 10 };

export default function AppTabs() {
  const t = useTexts();

  return (
    <NativeTabs tintColor={tint} labelStyle={labelStyle} minimizeBehavior="onScrollDown" hidden={useTabBarHidden()}>
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
