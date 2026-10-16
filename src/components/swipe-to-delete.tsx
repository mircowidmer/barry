import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTexts } from '@/lib/texts';

export function SwipeToDelete({
  label,
  onDelete,
  children,
}: {
  label: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress, _translation, swipeable) => (
        <DeleteAction label={label} progress={progress} swipeable={swipeable} onDelete={onDelete} />
      )}>
      {children}
    </Swipeable>
  );
}

function DeleteAction({
  label,
  progress,
  swipeable,
  onDelete,
}: {
  label: string;
  progress: SharedValue<number>;
  swipeable: SwipeableMethods;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const t = useTexts();
  // Without this the red action shows through the card's rounded corners while the card is closed.
  const visible = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));
  return (
    <Animated.View style={visible}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          swipeable.close();
          onDelete();
        }}
        style={[styles.action, { backgroundColor: theme.danger }]}>
        <ThemedText style={{ color: theme.onAccent, fontWeight: 600 }}>{t.common.delete}</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    marginLeft: Spacing.two,
    borderRadius: Spacing.three,
  },
});
