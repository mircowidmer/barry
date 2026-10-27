import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DestinationMap, type MapCamera } from '@/components/destination-map';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { barry, type Point } from '@/lib/barry';
import { useTexts } from '@/lib/texts';

const PIN = 38;
const STEM = 16;

/**
 * The whole screen of map under a pin that stays in the middle, as Apple Maps places a pin. The
 * Adventurer moves the map, not the pin, and the checkmark keeps the point under it.
 */
export function PinPicker({ start, onCancel, onPick }: { start: MapCamera | null; onCancel: () => void; onPick: (point: Point) => void }) {
  return (
    <Modal visible={start !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      {start && <PickerContent start={start} onCancel={onCancel} onPick={onPick} />}
    </Modal>
  );
}

function PickerContent({ start, onCancel, onPick }: { start: MapCamera; onCancel: () => void; onPick: (point: Point) => void }) {
  const theme = useTheme();
  const t = useTexts();
  const insets = useSafeAreaInsets();
  const [camera, setCamera] = useState(start);
  const [center, setCenter] = useState(start.center);
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    setLocating(true);
    const here = await barry.currentPosition();
    setLocating(false);
    if (here) setCamera({ center: here, zoom: Math.max(camera.zoom, start.zoom) });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <DestinationMap camera={camera} onCenter={setCenter} />
      <View pointerEvents="none" style={styles.pinSpot}>
        <View style={[styles.pin, { backgroundColor: theme.accent }]} />
        <View style={[styles.stem, { backgroundColor: theme.accent }]} />
      </View>

      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <RoundButton symbol="xmark" label={t.common.cancel} onPress={onCancel} />
        <GlassView style={[styles.title, !isLiquidGlassAvailable() && { backgroundColor: theme.background }]}>
          <ThemedText style={styles.titleText}>{t.plan.pinTitle}</ThemedText>
        </GlassView>
        <RoundButton symbol="checkmark" label={t.plan.usePin} prominent onPress={() => onPick(center)} />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.locateRow}>
          <RoundButton symbol="location.fill" label={t.plan.locate} disabled={locating} onPress={() => void locate()} />
        </View>
        <GlassView style={[styles.hint, !isLiquidGlassAvailable() && { backgroundColor: theme.background }]}>
          <ThemedText type="small">{t.plan.pinHint}</ThemedText>
        </GlassView>
      </View>
    </View>
  );
}

function RoundButton({
  symbol,
  label,
  onPress,
  prominent = false,
  disabled = false,
}: {
  symbol: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  prominent?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const glass = isLiquidGlassAvailable();
  return (
    <GlassView
      isInteractive
      {...(prominent && { tintColor: theme.accent })}
      style={[styles.round, !glass && { backgroundColor: prominent ? theme.accent : theme.background }, disabled && { opacity: 0.5 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={styles.roundTarget}>
        <SymbolView name={symbol} size={18} weight="semibold" tintColor={prominent ? theme.onAccent : theme.text} fallback={null} />
      </Pressable>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The stem's foot marks the point, so the pin stands on the middle of the map.
  pinSpot: { position: 'absolute', left: '50%', top: '50%', marginLeft: -PIN / 2, marginTop: -(PIN + STEM), alignItems: 'center' },
  pin: { width: PIN, height: PIN, borderRadius: PIN / 2, borderWidth: 3, borderColor: '#FFFFFF' },
  stem: { width: 3, height: STEM },
  header: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  title: { height: 44, paddingHorizontal: Spacing.three, borderRadius: 22, justifyContent: 'center' },
  titleText: { fontFamily: FontFamily, fontSize: 17 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, gap: Spacing.three },
  locateRow: { alignItems: 'flex-end' },
  hint: { borderRadius: 26, paddingHorizontal: 20, paddingVertical: Spacing.three },
  round: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  roundTarget: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
