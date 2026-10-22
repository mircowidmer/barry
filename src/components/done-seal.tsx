import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 104;
const RING = 10;

/** The round Done after a Check-in: an accent glass disc with a checkmark, held in a ring of clear glass. */
export function DoneSeal({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  const glass = isLiquidGlassAvailable();
  return (
    <GlassView glassEffectStyle="clear" style={[styles.ring, !glass && { backgroundColor: theme.backgroundElement }]}>
      <GlassView isInteractive tintColor={theme.accent} style={[styles.disc, !glass && { backgroundColor: theme.accent }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onPress}
          style={({ pressed }) => [styles.target, !glass && pressed && { opacity: 0.7 }]}>
          <SymbolView
            name="checkmark"
            weight="semibold"
            tintColor={theme.onAccent}
            size={32}
            fallback={<ThemedText style={{ color: theme.onAccent, fontSize: 28 }}>✓</ThemedText>}
          />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            {title}
          </ThemedText>
        </Pressable>
      </GlassView>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignSelf: 'center',
    width: SIZE + 2 * RING,
    height: SIZE + 2 * RING,
    borderRadius: (SIZE + 2 * RING) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' },
  target: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
