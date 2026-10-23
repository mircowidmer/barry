import { Host, HStack, ProgressView, Button as SwiftUIButton, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disable,
  font,
  frame,
  lineLimit,
  minimumScaleFactor,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import type { ButtonProps } from './button';

export function Button({ title, onPress, kind = 'primary', disabled, busy }: ButtonProps) {
  const theme = useTheme();
  return (
    // flexGrow shares a Row's width between its buttons; in a column the Host stretches to full width.
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <SwiftUIButton
        role={kind === 'danger' ? 'destructive' : 'default'}
        onPress={onPress}
        modifiers={[
          buttonStyle(kind === 'primary' ? 'glassProminent' : 'glass'),
          controlSize('large'),
          ...(kind === 'secondary' ? [] : [tint(kind === 'primary' ? theme.accent : theme.danger)]),
          disable(Boolean(disabled || busy)),
          accessibilityLabel(title),
        ]}>
        <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
          {busy && <ProgressView />}
          {/* A label shrinks a little before it wraps, so buttons sharing a Row keep one height. */}
          <Text modifiers={[font({ size: 17 }), lineLimit(1), minimumScaleFactor(0.8)]}>{title}</Text>
        </HStack>
      </SwiftUIButton>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { flexGrow: 1 },
});
