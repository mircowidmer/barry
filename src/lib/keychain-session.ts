/** The part of expo-secure-store the session needs, so the tests can fake it. */
export type Keychain = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** Where sessions were kept before the Keychain: the app's plain storage file. */
export type LegacyStorage = Pick<Storage, 'getItem' | 'removeItem'>;

/**
 * Keeps the Supabase session in the iOS Keychain instead of the app's storage file, which device backups
 * include. A session saved in the file before moves over on its first read, so nobody is signed out by the
 * update, and the file keeps no copy.
 */
export const keychainSessionStorage = (keychain: Keychain, legacy: LegacyStorage) => ({
  getItem: async (key: string): Promise<string | null> => {
    const kept = await keychain.getItemAsync(key);
    if (kept !== null) return kept;
    const old = legacy.getItem(key);
    if (old === null) return null;
    await keychain.setItemAsync(key, old);
    legacy.removeItem(key);
    return old;
  },
  setItem: (key: string, value: string): Promise<void> => keychain.setItemAsync(key, value),
  removeItem: async (key: string): Promise<void> => {
    await keychain.deleteItemAsync(key);
    legacy.removeItem(key);
  },
});
