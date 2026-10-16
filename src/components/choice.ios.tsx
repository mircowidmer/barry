import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import type { Option } from '@/components/choice';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** The native segmented control, which iOS draws in Liquid Glass. */
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
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Host matchContents={{ horizontal: false, vertical: true }} style={styles.host}>
        <Picker modifiers={[pickerStyle('segmented')]} label={label} selection={value} onSelectionChange={onChange}>
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.title}
            </Text>
          ))}
        </Picker>
      </Host>
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
  host: { width: '100%' },
});
