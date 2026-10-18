import { router, usePreventRemove } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useTexts } from '@/lib/texts';

/**
 * Keeps a sheet with unsaved changes from closing, whether by Cancel or by swiping it down,
 * until the Adventurer agrees to discard them. leave() closes the sheet without asking, for
 * after a save.
 */
export function useDiscardGuard(dirty: boolean) {
  const t = useTexts();
  const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
    Alert.alert(t.common.discardTitle, t.common.discardMessage, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.discard, style: 'destructive', onPress: repeat },
    ]);
  });
  const leave = useCallback(() => {
    disablePrevention();
    router.back();
  }, [disablePrevention]);
  return leave;
}
