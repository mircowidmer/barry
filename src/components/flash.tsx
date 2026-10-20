import { type ReactNode, useEffect } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** How long the tint holds, then how long it takes to fade, so the eye finds the row after the scroll ends. */
const FLASH_HOLD_MS = 600;
const FLASH_FADE_MS = 1200;

/** Tints its row in the accent colour once `active` turns true, then fades back to nothing. */
export function Flash({
  active,
  onLayout,
  children,
}: {
  active: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    opacity.value = withSequence(withTiming(0.25, { duration: 150 }), withDelay(FLASH_HOLD_MS, withTiming(0, { duration: FLASH_FADE_MS })));
  }, [active, opacity]);

  const tint = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View onLayout={onLayout}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.accent }, tint]} />
    </View>
  );
}
