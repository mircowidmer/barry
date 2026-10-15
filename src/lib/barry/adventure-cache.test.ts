import { describe, expect, it } from '@jest/globals';

import { createAdventureCache } from './adventure-cache';
import type { AdventureWithRelations } from './rows';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const row = { id: 'a1', stage: 'active', deadline: '2026-10-17T16:00:00Z' } as AdventureWithRelations;
const savedAt = new Date('2026-10-17T12:00:00Z');

describe('the live Adventure cache', () => {
  it('returns the last saved row with when it was saved, across app restarts', () => {
    const storage = memoryStorage();
    createAdventureCache(storage, () => savedAt).save(row);
    expect(createAdventureCache(storage, () => new Date()).load()).toEqual({ row, savedAt });
  });

  it('forgets the Adventure once the server says none is live', () => {
    const cache = createAdventureCache(memoryStorage(), () => savedAt);
    cache.save(row);
    cache.save(null);
    expect(cache.load()).toBeNull();
  });
});
