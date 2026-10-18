import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function SelectionCircle({ selected }: { selected: boolean }) {
  const theme = useTheme();
  const color = selected ? theme.accent : theme.textSecondary;
  return (
    <SymbolView
      name={selected ? 'checkmark.circle.fill' : 'circle'}
      tintColor={color}
      size={24}
      fallback={<ThemedText style={{ color }}>{selected ? '●' : '○'}</ThemedText>}
    />
  );
}
