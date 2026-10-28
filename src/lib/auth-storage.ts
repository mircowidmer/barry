import * as SecureStore from 'expo-secure-store';

import { keychainSessionStorage } from '@/lib/keychain-session';
import { storage } from '@/lib/storage';

// After the first unlock, because the Trail and the waiting Check-in upload in the background while the phone is
// locked. This device only, so a backup restored to another phone carries no session.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const authStorage = keychainSessionStorage(
  {
    getItemAsync: (key) => SecureStore.getItemAsync(key, options),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
    deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
  },
  storage,
);
