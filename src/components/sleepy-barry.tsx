import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// Barry's coat, taken from the app icon. He keeps these colours in both themes.
const COAT = '#1C1A19';
const BLAZE = '#FAF8F5';
const TAN = '#D9822B';
const EYE = '#4A2A1A';
const TONGUE = '#E86A7A';

/** The face is drawn on a 100-point grid and scaled to this size. */
const BARRY_SIZE = 36;

/**
 * Barry asleep, waking as progress runs from 0 to 1: his eyes open, his brows lift and his ears perk up.
 * Once awake he sticks his tongue out and says woof.
 */
export function SleepyBarry({ progress, awake, woof }: { progress: Animated.Value; awake: boolean; woof: string }) {
  const eyes = progress.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] });
  const brows = progress.interpolate({ inputRange: [0, 1], outputRange: [3, -2] });
  const leftEar = progress.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '32deg'] });
  const rightEar = progress.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '-32deg'] });
  const snore = progress.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <View style={styles.grid}>
        <Animated.View style={[styles.ear, { left: 4, transform: [{ rotate: leftEar }] }]} />
        <Animated.View style={[styles.ear, { right: 4, transform: [{ rotate: rightEar }] }]} />
        <View style={styles.head} />
        <View style={[styles.cheek, { left: 19 }]} />
        <View style={[styles.cheek, { right: 19 }]} />
        <View style={styles.stripe} />
        <View style={styles.muzzle} />
        <Animated.View style={[styles.brow, { left: 32.5, transform: [{ translateY: brows }] }]} />
        <Animated.View style={[styles.brow, { right: 32.5, transform: [{ translateY: brows }] }]} />
        <Animated.View style={[styles.eye, { left: 32.5, transform: [{ scaleY: eyes }] }]} />
        <Animated.View style={[styles.eye, { right: 32.5, transform: [{ scaleY: eyes }] }]} />
        <View style={styles.nose} />
        <View style={styles.mouth} />
        {awake && <View style={styles.tongue} />}
        <Animated.Text style={[styles.snore, { opacity: snore }]}>z z</Animated.Text>
      </View>
      {awake && (
        <View style={styles.bubble}>
          <ThemedText type="smallBold" style={{ color: COAT }}>
            {woof}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const SCALE = BARRY_SIZE / 100;
const OFFSET = (BARRY_SIZE - 100) / 2;

const styles = StyleSheet.create({
  box: { width: BARRY_SIZE, height: BARRY_SIZE },
  grid: { position: 'absolute', left: OFFSET, top: OFFSET, width: 100, height: 100, transform: [{ scale: SCALE }] },
  ear: { position: 'absolute', top: 26, width: 26, height: 48, borderRadius: 13, backgroundColor: COAT, transformOrigin: '50% 0%' },
  head: { position: 'absolute', left: 16, top: 12, width: 68, height: 78, borderRadius: 34, backgroundColor: COAT },
  cheek: { position: 'absolute', top: 54, width: 24, height: 24, borderRadius: 12, backgroundColor: TAN },
  stripe: { position: 'absolute', left: 45, top: 16, width: 10, height: 44, borderRadius: 5, backgroundColor: BLAZE },
  muzzle: { position: 'absolute', left: 31, top: 52, width: 38, height: 34, borderRadius: 18, backgroundColor: BLAZE },
  brow: { position: 'absolute', top: 33.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: TAN },
  eye: { position: 'absolute', top: 41.5, width: 9, height: 9, borderRadius: 4.5, backgroundColor: EYE },
  nose: {
    position: 'absolute',
    left: 43,
    top: 58,
    width: 14,
    height: 10,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    backgroundColor: COAT,
  },
  mouth: {
    position: 'absolute',
    left: 43,
    top: 68,
    width: 14,
    height: 7,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderColor: COAT,
  },
  tongue: { position: 'absolute', left: 45, top: 73, width: 10, height: 13, borderRadius: 5, backgroundColor: TONGUE },
  snore: { position: 'absolute', left: -10, top: -6, color: BLAZE, fontSize: 22, fontWeight: '700' },
  bubble: {
    position: 'absolute',
    right: BARRY_SIZE - 4,
    top: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: BLAZE,
  },
});
