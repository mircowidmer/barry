import { type ReactNode, useState } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSegments } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTexts } from '@/lib/texts';

export { Button } from '@/components/button';

/** What a screen shows while its first load is on its way. */
export function Loading() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.textSecondary} style={styles.loading} />;
}

/** Dims a tappable card while the finger is down, as iOS cells highlight. */
export const pressedStyle = ({ pressed }: { pressed: boolean }) => pressed && { opacity: 0.6 };

/** A scrolling screen. With onRefresh, pulling down reloads it, as iOS lists do. */
export function Screen({ title, onRefresh, children }: { title?: string; onRefresh?: () => Promise<unknown>; children: ReactNode }) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  // The tab bar needs a gap above it. Without one, the home indicator inset is gap enough.
  const aboveTabBar = (useSegments() as string[]).includes('(tabs)');
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh && <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textSecondary} />}
      contentContainerStyle={[styles.screen, !aboveTabBar && { paddingBottom: 0 }]}>
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

type Toggle = { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean };

export function Field({ label, hint, toggle, ...input }: { label: string; hint?: string; toggle?: Toggle } & TextInputProps) {
  const theme = useTheme();
  const t = useTexts();
  const dimmed = input.editable === false || (toggle !== undefined && !toggle.value && !toggle.disabled);
  return (
    <View style={styles.field}>
      <View style={styles.label}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {toggle && (
          <Switch
            accessibilityLabel={t.common.useLabel(label)}
            value={toggle.value}
            onValueChange={toggle.onValueChange}
            disabled={toggle.disabled}
            trackColor={{ true: theme.success }}
          />
        )}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: dimmed ? theme.textSecondary : theme.text,
            backgroundColor: input.editable === false ? theme.backgroundElement : theme.background,
            borderColor: theme.backgroundSelected,
          },
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

const HOLD_MS = 1500;

/** Completes only after a deliberate hold, so a pocket press cannot end protection. */
export function HoldButton({ title, onComplete, disabled }: { title: string; onComplete: () => void; disabled?: boolean }) {
  const theme = useTheme();
  const t = useTexts();
  const [progress] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);

  const start = () => {
    setHolding(true);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, useNativeDriver: false }).start(({ finished }) => {
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
      style={[styles.hold, glass ? styles.capsule : { backgroundColor: theme.success, borderRadius: Spacing.two }, disabled && { opacity: 0.6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={t.adventure.holdHint}
        accessibilityState={{ disabled, busy: disabled }}
        disabled={disabled}
        onPressIn={start}
        onPressOut={cancel}
        style={styles.holdTarget}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.onAccent, opacity: 0.25, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        <ThemedText style={{ color: theme.onAccent, fontWeight: 700 }}>{holding ? t.adventure.keepHolding : title}</ThemedText>
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
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  field: { gap: Spacing.one },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 31 },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 10, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  hold: { minHeight: 64, overflow: 'hidden' },
  capsule: { borderRadius: 32 },
  holdTarget: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  notice: { borderLeftWidth: 4, paddingLeft: Spacing.two, paddingVertical: Spacing.one },
  loading: { marginTop: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
