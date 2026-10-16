import { type ReactNode, useState } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export { Button } from '@/components/button';

export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}>
      {title && <ThemedText type="subtitle">{title}</ThemedText>}
      {children}
    </ScrollView>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
      {title && <ThemedText type="smallBold">{title}</ThemedText>}
      {children}
    </View>
  );
}

export function Field({ label, hint, ...input }: { label: string; hint?: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
          input.multiline && styles.multiline,
        ]}
        {...input}
      />
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

/** Completes only after a deliberate hold, so a pocket press cannot end protection. */
export function HoldButton({ title, onComplete, holdMs = 1500 }: { title: string; onComplete: () => void; holdMs?: number }) {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);

  const start = () => {
    setHolding(true);
    Animated.timing(progress, { toValue: 1, duration: holdMs, useNativeDriver: false }).start(({ finished }) => {
      setHolding(false);
      progress.setValue(0);
      if (finished) onComplete();
    });
  };
  const cancel = () => {
    progress.stopAnimation();
    progress.setValue(0);
    setHolding(false);
  };

  const glass = isLiquidGlassAvailable();
  return (
    <GlassView
      isInteractive
      tintColor={theme.success}
      style={[styles.hold, glass ? styles.capsule : { backgroundColor: theme.success, borderRadius: Spacing.two }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint="Press and hold"
        onPressIn={start}
        onPressOut={cancel}
        style={styles.holdTarget}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.onAccent, opacity: 0.25, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        <ThemedText style={{ color: theme.onAccent, fontWeight: 700 }}>{holding ? 'Keep holding…' : title}</ThemedText>
      </Pressable>
    </GlassView>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const theme = useTheme();
  const color = tone === 'info' ? theme.accent : theme[tone];
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      <ThemedText style={{ color }}>{children}</ThemedText>
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six * 2,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 10, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  hold: { minHeight: 64, overflow: 'hidden' },
  capsule: { borderRadius: 32 },
  holdTarget: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  notice: { borderLeftWidth: 4, paddingLeft: Spacing.two, paddingVertical: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
