import { NativeTabs } from 'expo-router/native-tabs';
import { StyleSheet, View } from 'react-native';

import { HoldButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CheckInOffer, WaitingCheckIn } from '@/lib/live-check-in';
import { useTexts } from '@/lib/texts';
import { formatClock } from '@/lib/wording';

// iOS draws the accessory twice, full width above the tab bar and inline beside it once the bar shrinks on scroll.
export function CheckInAccessory({ offer }: { offer: CheckInOffer }) {
  const t = useTexts();
  const inline = NativeTabs.BottomAccessory.usePlacement() === 'inline';
  if (offer.waiting) return <Waiting waiting={offer.waiting} inline={inline} />;
  return (
    <HoldButton
      title={t.adventure.hold}
      onComplete={offer.checkIn}
      disabled={offer.busy}
    />
  );
}

/** In place of the Check In button while a Check-in waits for signal: it is done, so nothing is left to hold. */
function Waiting({ waiting: { at, keepsTrying }, inline }: { waiting: WaitingCheckIn; inline: boolean }) {
  const theme = useTheme();
  const t = useTexts();
  const title = t.adventure.waitingCheckIn(formatClock(at));
  return (
    <View
      accessible
      accessibilityLabel={`${t.adventure.queued(t.when(at))}${keepsTrying ? t.adventure.keepsTrying : ''}`}
      style={[styles.waiting, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText numberOfLines={1} style={styles.title}>
        {inline ? title : `${title} · ${t.adventure.waitingForSignal}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // Like the Hold button, the accessory sets the height and the radius keeps the ends round.
  waiting: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  title: { fontWeight: 600 },
});
