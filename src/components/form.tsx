import { type ReactNode, type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useNavigation, useSegments } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Switch,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, MaxContentWidth, Spacing } from '@/constants/theme';
import { useInputColors } from '@/hooks/use-input-colors';
import { useTheme } from '@/hooks/use-theme';
import { useTexts } from '@/lib/texts';

export { Button } from '@/components/button';

export function Loading() {
  const theme = useTheme();
  return <ActivityIndicator color={theme.textSecondary} style={styles.loading} />;
}

export function FirstLoad({ failure, onRetry }: { failure: string | undefined; onRetry: () => void }) {
  const t = useTexts();
  if (failure === undefined) return <Loading />;
  return (
    <>
      <Notice tone="danger">{failure}</Notice>
      <Button title={t.common.tryAgain} onPress={onRetry} />
    </>
  );
}

// A reload that fails keeps the data on screen, so the failure shows above it instead of in its place.
export function LoadState({
  loaded,
  failure,
}: {
  loaded: { data: unknown; error: Error | undefined; reload: () => void };
  failure: (error: Error) => string;
}) {
  if (loaded.data === undefined) return <FirstLoad failure={loaded.error && failure(loaded.error)} onRetry={loaded.reload} />;
  return loaded.error ? <Notice tone="danger">{failure(loaded.error)}</Notice> : null;
}

export const pressedStyle = ({ pressed }: { pressed: boolean }) => pressed && { opacity: 0.6 };

/** With a footer, the footer floats above the tab bar, and the content scrolls up past it. */
export function Screen({
  ref,
  title,
  onRefresh,
  footer,
  children,
}: {
  ref?: Ref<ScrollViewInstance>;
  title?: string;
  onRefresh?: () => Promise<unknown>;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  // The tab bar needs a gap above it. Without one, the home indicator inset is gap enough.
  const aboveTabBar = (useSegments() as string[]).includes('(tabs)');
  const scroll = useRef<ScrollViewInstance>(null);
  useImperativeHandle(ref, () => scroll.current as ScrollViewInstance, []);
  // The top sits above 0 by the header's height, which iOS adds unseen by React Native, whose scrollTo stops at 0
  // without scrollToOverflowEnabled. The first drag starts from the top, and a screen never dragged is still there.
  const top = useRef<number | null>(null);
  const navigation = useNavigation();
  // The parent is the tab's stack, which gains focus only when its tab is selected, not when a screen in it
  // closes, so switching tabs starts at the top while going back within a tab keeps the place. The scroll animates
  // because a jump leaves the large title collapsed, and iOS then expands it and pushes the content below the top.
  useEffect(() => {
    if (!aboveTabBar) return;
    return navigation.getParent()?.addListener('focus', () => {
      if (top.current !== null) scroll.current?.scrollTo({ y: top.current, animated: true });
    });
  }, [aboveTabBar, navigation]);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  };
  const content = (
    <ScrollView
      ref={scroll}
      scrollToOverflowEnabled
      onScrollBeginDrag={(event) => {
        top.current ??= event.nativeEvent.contentOffset.y;
      }}
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={onRefresh && <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textSecondary} />}
      contentContainerStyle={[styles.screen, !aboveTabBar && { paddingBottom: 0 }, footer !== undefined && styles.underFooter]}>
      {title && <ThemedText type="subtitle">{title}</ThemedText>}
      {children}
    </ScrollView>
  );
  if (footer === undefined) return content;
  // The safe area of a tab's screen ends at the top of the tab bar, so the footer floats just above it.
  return (
    <View style={styles.withFooter}>
      {content}
      <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={styles.footer}>
        {footer}
      </SafeAreaView>
    </View>
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
  const inputColors = useInputColors();
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
        {...inputColors}
        spellCheck={false}
        autoCorrect={false}
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
  withFooter: { flex: 1 },
  // The footer's height and the gaps around it, so the last content scrolls clear of it.
  underFooter: { paddingBottom: 64 + Spacing.three * 3 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  section: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  field: { gap: Spacing.one },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 31 },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 10, fontSize: 16, fontFamily: FontFamily },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  hold: { minHeight: 64, overflow: 'hidden' },
  capsule: { borderRadius: 32 },
  holdTarget: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  notice: { borderLeftWidth: 4, paddingLeft: Spacing.two, paddingVertical: Spacing.one },
  loading: { marginTop: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
