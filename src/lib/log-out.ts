import { Alert } from 'react-native';

import { barry } from '@/lib/barry';
import { currentTexts } from '@/lib/texts';

const confirmed = () => {
  const t = currentTexts();
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      t.dialogs.logOutTitle,
      t.dialogs.logOutMessage,
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: t.profile.logOut, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
};

export const askToLogOut = async () => {
  if (await confirmed()) await barry.logOut().catch(() => undefined);
};
