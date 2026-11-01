import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Children, isValidElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useInputColors } from '@/hooks/use-input-colors';
import { useTheme } from '@/hooks/use-theme';

/**
 * An inset group of rows like in Settings, with an optional header above and footer below. inset is
 * where the separators start, so rows that lead with a picture can start them at the text. `footerInfo` sets the
 * footer as an InfoNote, for a footer that explains rather than labels; `footerTone` sets it as a Note in that tone,
 * for a state or a result that belongs to this group.
 */
export function Group({
  title,
  footer,
  footerInfo = false,
  footerTone,
  footerIcon,
  inset = Spacing.three,
  children,
}: {
  title?: string;
  footer?: string | undefined;
  footerInfo?: boolean;
  footerTone?: NoteTone | undefined;
  footerIcon?: SymbolViewProps['name'] | undefined;
  inset?: number;
  children: ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title && <GroupHeader title={title} />}
      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        {rows.map((row, i) => (
          <View key={isValidElement(row) ? row.key : i}>
            {i > 0 && <View style={[styles.separator, { marginLeft: inset, backgroundColor: theme.backgroundSelected }]} />}
            {row}
          </View>
        ))}
      </View>
      {footer &&
        (footerTone ? (
          <Note tone={footerTone} icon={footerIcon}>
            {footer}
          </Note>
        ) : footerInfo ? (
          <InfoNote>{footer}</InfoNote>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            {footer}
          </ThemedText>
        ))}
    </View>
  );
}

/** The header above a group, such as `IN AN ALERT`, for a card that is not a Group. */
export function GroupHeader({ title }: { title: string }) {
  return (
    <ThemedText type="small" mono themeColor="textSecondary" style={styles.header}>
      {title.toUpperCase()}
    </ThemedText>
  );
}

/** A small note with an info symbol in front, under a group or on its own. */
export function InfoNote({ children }: { children: string }) {
  return <Note>{children}</Note>;
}

type NoteTone = 'secondary' | 'success' | 'warning' | 'danger';

const NOTE_ICON: Record<NoteTone, SymbolViewProps['name']> = {
  secondary: 'info.circle',
  success: 'checkmark.circle',
  warning: 'exclamationmark.triangle',
  danger: 'exclamationmark.circle',
};

/**
 * A state or a result in a line of its own, with a symbol in front, so it reads by its shape as well as its colour:
 * under a group as its footer, or under a screen's title for a state of the whole screen.
 */
export function Note({ tone = 'secondary', icon, children }: { tone?: NoteTone; icon?: SymbolViewProps['name'] | undefined; children: string }) {
  const theme = useTheme();
  const color = tone === 'secondary' ? 'textSecondary' : tone;
  return (
    <View style={styles.info} accessible accessibilityRole={tone === 'danger' ? 'alert' : 'text'}>
      <SymbolView
        name={icon ?? NOTE_ICON[tone]}
        size={17}
        tintColor={theme[color]}
        fallback={<ThemedText themeColor={color}>{tone === 'success' ? '✓' : tone === 'secondary' ? 'i' : '!'}</ThemedText>}
      />
      <ThemedText themeColor={color} style={styles.infoText}>
        {children}
      </ThemedText>
    </View>
  );
}

/** A label on the left and the value it edits on the right. */
export function InputRow({ label, ...input }: { label: string } & TextInputProps) {
  const theme = useTheme();
  const inputColors = useInputColors();
  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        {...inputColors}
        spellCheck={false}
        autoCorrect={false}
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
  const inputColors = useInputColors();
  return (
    <TextInput
      accessibilityLabel={label}
      {...inputColors}
      spellCheck={false}
      autoCorrect={false}
      style={[styles.textArea, { color: theme.text }]}
      multiline
      {...input}
    />
  );
}

/** A label and a value that cannot be changed here; `mono` sets a number such as a phone number in Nordwand Mono. */
export function ValueRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText themeColor="textSecondary" mono={mono} numberOfLines={1} style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

/** A label and a switch, such as whether Barry may use an address. */
export function SwitchRow({
  label,
  accessibilityLabel,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <ThemedText style={styles.action}>{label}</ThemedText>
      <Switch
        accessibilityLabel={accessibilityLabel ?? label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: theme.success }}
      />
    </View>
  );
}

/** A tappable row: a link with a chevron, or an action in the accent or danger colour, greyed out while disabled. */
export function ActionRow({
  title,
  onPress,
  tone = 'accent',
  chevron = false,
  centered = false,
  busy = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'text';
  chevron?: boolean;
  centered?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={chevron ? 'link' : 'button'}
      accessibilityState={{ busy, disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText style={[styles.action, centered && styles.centered, { color: disabled ? theme.textSecondary : theme[tone] }]}>{title}</ThemedText>
      {busy && <ActivityIndicator color={theme.textSecondary} />}
      {chevron && (
        <SymbolView
          name="chevron.right"
          size={14}
          weight="semibold"
          tintColor={theme.textSecondary}
          fallback={<ThemedText themeColor="textSecondary" style={styles.chevron}>›</ThemedText>}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  header: { paddingHorizontal: Spacing.three, fontSize: 13 },
  footer: { paddingHorizontal: Spacing.three, fontSize: 13 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: Spacing.three },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  box: { borderRadius: 12, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three },
  // The label may wrap at large text sizes, but never takes the whole row from the input.
  label: { flexShrink: 1, maxWidth: '55%' },
  input: { flex: 1, fontSize: 17, paddingVertical: 11 },
  value: { flex: 1, textAlign: 'right' },
  textArea: { minHeight: 88, fontSize: 17, paddingHorizontal: Spacing.three, paddingVertical: 11, textAlignVertical: 'top' },
  action: { flex: 1 },
  centered: { textAlign: 'center' },
  chevron: { fontSize: 22 },
});
