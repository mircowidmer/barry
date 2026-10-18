import { Children, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** An inset group of rows like in Settings, with an optional header above and footer below. */
export function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.header}>
          {title.toUpperCase()}
        </ThemedText>
      )}
      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 && <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />}
            {row}
          </View>
        ))}
      </View>
      {footer && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
          {footer}
        </ThemedText>
      )}
    </View>
  );
}

/** A label on the left and the value it edits on the right. */
export function InputRow({ label, ...input }: { label: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
        textAlign="right"
        {...input}
      />
    </View>
  );
}

/** A text that fills the row and grows with its lines, such as notes. */
export function TextAreaRow({ label, ...input }: { label: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={theme.textSecondary}
      style={[styles.textArea, { color: theme.text }]}
      multiline
      {...input}
    />
  );
}

/** A label and a value that cannot be changed here. */
export function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

/** A tappable row: a link with a chevron, or an action in the accent or danger colour. */
export function ActionRow({
  title,
  onPress,
  tone = 'accent',
  chevron = false,
  busy = false,
}: {
  title: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'text';
  chevron?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={chevron ? 'link' : 'button'}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={[styles.action, { color: theme[tone] }]}>{title}</ThemedText>
      {busy && <ActivityIndicator />}
      {chevron && <ThemedText themeColor="textSecondary" style={styles.chevron}>›</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  header: { paddingHorizontal: Spacing.three, fontSize: 13 },
  footer: { paddingHorizontal: Spacing.three, fontSize: 13 },
  box: { borderRadius: 12, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three },
  label: { flexShrink: 0 },
  input: { flex: 1, fontSize: 17, paddingVertical: 11 },
  value: { flex: 1, textAlign: 'right' },
  textArea: { minHeight: 88, fontSize: 17, paddingHorizontal: Spacing.three, paddingVertical: 11, textAlignVertical: 'top' },
  action: { flex: 1 },
  chevron: { fontSize: 22 },
});
