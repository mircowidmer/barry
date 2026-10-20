import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * The colours every text input shares. Android paints selectionColor as an opaque highlight behind
 * the selected text, so it gets a translucent accent there and the opaque accent for cursor and handles.
 */
export function useInputColors() {
  const theme = useTheme();
  return {
    placeholderTextColor: theme.textSecondary,
    selectionColor: Platform.OS === 'android' ? `${theme.accent}55` : theme.accent,
    cursorColor: theme.accent,
    selectionHandleColor: theme.accent,
  };
}
