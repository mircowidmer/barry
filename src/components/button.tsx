import type { ButtonProps as SwiftUIButtonProps } from '@expo/ui/swift-ui';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  icon?: NonNullable<SwiftUIButtonProps['systemImage']>;
};

export function Button({ title, onPress, kind = 'primary', disabled, busy, icon }: ButtonProps) {
  const theme = useTheme();
  const background = kind === 'primary' ? theme.accent : kind === 'danger' ? theme.danger : theme.backgroundSelected;
  const color = kind === 'secondary' ? theme.text : theme.onAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        icon && styles.iconButton,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      {busy ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <SymbolView name={icon} tintColor={color} size={24} fallback={<ButtonTitle title={title} color={color} />} />
      ) : (
        <ButtonTitle title={title} color={color} />
      )}
    </Pressable>
  );
}

function ButtonTitle({ title, color }: { title: string; color: string }) {
  return <ThemedText style={{ color, fontWeight: 600 }}>{title}</ThemedText>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: { flex: 1 },
});
