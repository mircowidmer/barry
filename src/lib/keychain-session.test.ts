import { describe, expect, it } from '@jest/globals';

import { type Keychain, keychainSessionStorage } from './keychain-session';

const setup = (file: Record<string, string> = {}) => {
  const keychain = new Map<string, string>();
  let reads = 0;
  const fake: Keychain = {
    getItemAsync: async (key) => {
      reads += 1;
      return keychain.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      keychain.set(key, value);
    },
    deleteItemAsync: async (key) => {
      keychain.delete(key);
    },
  };
  const legacy = {
    getItem: (key: string) => file[key] ?? null,
    removeItem: (key: string) => {
      delete file[key];
    },
  };
  return { keychain, file, storage: keychainSessionStorage(fake, legacy), reads: () => reads };
};

describe('keychainSessionStorage', () => {
  it('keeps a new session in the Keychain and nowhere else', async () => {
    const { keychain, file, storage } = setup();
    await storage.setItem('sb-auth-token', '{"access_token":"a"}');
    expect(keychain.get('sb-auth-token')).toBe('{"access_token":"a"}');
    expect(file).toEqual({});
    expect(await storage.getItem('sb-auth-token')).toBe('{"access_token":"a"}');
  });

  it('moves a session from the storage file into the Keychain on its first read, so the update signs nobody out', async () => {
    const { keychain, file, storage } = setup({ 'sb-auth-token': '{"access_token":"old"}' });
    expect(await storage.getItem('sb-auth-token')).toBe('{"access_token":"old"}');
    expect(keychain.get('sb-auth-token')).toBe('{"access_token":"old"}');
    expect(file).toEqual({});
  });

  it('removes the session from both places on sign-out', async () => {
    const { keychain, file, storage } = setup({ 'sb-auth-token': 'old' });
    keychain.set('sb-auth-token', 'new');
    await storage.removeItem('sb-auth-token');
    expect(keychain.size).toBe(0);
    expect(file).toEqual({});
    expect(await storage.getItem('sb-auth-token')).toBeNull();
  });

  it('reads the Keychain once per key, because Supabase asks for the session on every request', async () => {
    const { storage, reads } = setup();
    expect(await storage.getItem('sb-auth-token')).toBeNull();
    expect(await storage.getItem('sb-auth-token')).toBeNull();
    expect(reads()).toBe(1);
    await storage.setItem('sb-auth-token', 'new');
    expect(await storage.getItem('sb-auth-token')).toBe('new');
    expect(reads()).toBe(1);
  });

  it('answers a read that was under way with the session written meanwhile', async () => {
    const { storage } = setup({ 'sb-auth-token': 'old' });
    const [first] = await Promise.all([storage.getItem('sb-auth-token'), storage.setItem('sb-auth-token', 'new')]);
    expect(first).toBe('new');
    expect(await storage.getItem('sb-auth-token')).toBe('new');
  });
});
