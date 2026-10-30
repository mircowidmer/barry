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
export const keychainSessionStorage = (keychain: Keychain, legacy: LegacyStorage) => {
  // Supabase asks for the session on every request and every refresh tick, so the Keychain is read once per key.
  const known = new Map<string, string | null>();
  const read = async (key: string): Promise<string | null> => {
    const kept = await keychain.getItemAsync(key);
    if (kept !== null) return kept;
    const old = legacy.getItem(key);
    if (old === null) return null;
    try {
      await keychain.setItemAsync(key, old);
      legacy.removeItem(key);
    } catch {
      // The file keeps the session, and the next launch moves it again.
    }
    return old;
  };
  return {
    getItem: async (key: string): Promise<string | null> => {
      if (!known.has(key)) {
        let value: string | null;
        try {
          value = await read(key);
        } catch {
          // Not remembered, so the next request reads the Keychain again; until then requests fail like a lost signal.
          return null;
        }
        // A write that landed while the Keychain was read is the newer one.
        if (!known.has(key)) known.set(key, value);
      }
      return known.get(key) ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      await keychain.setItemAsync(key, value);
      known.set(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
      await keychain.deleteItemAsync(key);
      legacy.removeItem(key);
      known.set(key, null);
    },
  };
};
