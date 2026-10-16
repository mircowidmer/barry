import { Button, Host, HStack } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled, labelStyle, tint } from '@expo/ui/swift-ui/modifiers';

import { useTheme } from '@/hooks/use-theme';

import type { IconAction } from './icon-actions';

export function IconActions({ actions }: { actions: IconAction[] }) {
  const theme = useTheme();
  return (
    <Host matchContents style={{ alignSelf: 'center' }}>
      <HStack spacing={20}>
        {actions.map((action) => (
          <Button
            key={action.label}
            label={action.label}
            systemImage={action.icon}
            role={action.kind === 'danger' ? 'destructive' : 'default'}
            onPress={action.onPress}
            modifiers={[
              labelStyle('iconOnly'),
              buttonStyle(action.kind === 'primary' ? 'glassProminent' : 'glass'),
              buttonBorderShape('circle'),
              controlSize('extraLarge'),
              ...(action.kind === 'secondary' ? [] : [tint(action.kind === 'primary' ? theme.accent : theme.danger)]),
              disabled(Boolean(action.disabled || action.busy)),
            ]}
          />
        ))}
      </HStack>
    </Host>
  );
}
