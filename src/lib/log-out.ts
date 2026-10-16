import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

const confirmed = () =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Log out?',
      'You need your email address and password to sign in again.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Log Out', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export const askToLogOut = async () => {
  if (await confirmed()) await supabase.auth.signOut();
};
