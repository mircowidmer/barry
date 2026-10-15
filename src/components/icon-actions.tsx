import type { ButtonProps } from '@expo/ui/swift-ui';

import { Button, Row } from '@/components/form';

export type IconAction = {
  label: string;
  icon: NonNullable<ButtonProps['systemImage']>;
  kind: 'primary' | 'secondary' | 'danger';
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function IconActions({ actions }: { actions: IconAction[] }) {
  return (
    <Row>
      {actions.map((action) => (
        <Button
          key={action.label}
          title={action.label}
          icon={action.icon}
          kind={action.kind}
          onPress={action.onPress}
          disabled={action.disabled}
          busy={action.busy}
        />
      ))}
    </Row>
  );
}
