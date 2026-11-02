import type { AdventureWithRelations } from './rows';

const KEY = 'barry.inProgressAdventure';

type CachedAdventure = { row: AdventureWithRelations; savedAt: Date };

/** The last live Adventure the server returned, so the app can show it and accept a Check-in without signal. */
export const createAdventureCache = (storage: Pick<Storage, 'getItem' | 'setItem'>, now: () => Date) => ({
  save: (row: AdventureWithRelations | null) =>
    storage.setItem(KEY, row ? JSON.stringify({ row, savedAt: now().toISOString() }) : ''),
  load: (): CachedAdventure | null => {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const { row, savedAt } = JSON.parse(raw) as { row: AdventureWithRelations; savedAt: string };
    return { row, savedAt: new Date(savedAt) };
  },
});
