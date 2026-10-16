import { Host, HStack, ProgressView, Button as SwiftUIButton, Text } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled as disable, frame, tint } from '@expo/ui/swift-ui/modifiers';

import { useTheme } from '@/hooks/use-theme';

import type { ButtonProps } from './button';

export function Button({ title, onPress, kind = 'primary', disabled, busy }: ButtonProps) {
  const theme = useTheme();
  return (
    // flexGrow shares a Row's width between its buttons; in a column the Host stretches to full width.
    <Host matchContents={{ vertical: true }} style={{ flexGrow: 1 }}>
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
          <Text>{title}</Text>
        </HStack>
      </SwiftUIButton>
    </Host>
  );
}
