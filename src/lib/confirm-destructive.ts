import { Alert } from 'react-native';

import { currentTexts } from '@/lib/texts';

/** Asks before something that cannot be undone. Cancel, or dismissing the alert, answers false. */
export const confirmDestructive = ({ title, message, action }: { title: string; message: string; action?: string }) => {
  const t = currentTexts();
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: action ?? t.common.delete, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
};
