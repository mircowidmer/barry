import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Option<T extends string> = { value: T; title: string };

export function Choice<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.choice, { borderColor: theme.backgroundSelected }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.title}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={[styles.choiceOption, { backgroundColor: selected ? theme.accent : theme.background }]}>
              <ThemedText style={{ color: selected ? theme.onAccent : theme.text, fontWeight: 600 }}>{option.title}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      {hint && (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  choice: { flexDirection: 'row', borderWidth: 1, borderRadius: Spacing.two, overflow: 'hidden' },
  choiceOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
