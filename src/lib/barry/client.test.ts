import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

import { createAdventureCache } from './adventure-cache';
import { createBarry } from './client';
import type { AdventureWithRelations } from './rows';
import type { LocationService } from './trail';
import type { AdventureId } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const a1 = 'a1' as AdventureId;

const row = (overrides: Partial<AdventureWithRelations>): AdventureWithRelations => ({
  id: 'a1',
  adventurer_id: 'u1',
  stage: 'active',
  destination: 'Grosser Mythen',
  route: null,
  starting_point: null,
  notes: null,
  deadline: '2026-10-17T16:00:00Z',
  alert_at: '2026-10-17T16:30:00Z',
  deadline_set_at: '2026-10-17T06:00:00Z',
  time_zone: 'Europe/Zurich',
  started_at: '2026-10-17T06:00:00Z',
  alerts_sent: 0,
  last_alert_at: null,
  checked_in_at: null,
  ended_at: null,
  created_at: '2026-10-15T08:00:00Z',
  updated_at: '2026-10-15T08:00:00Z',
  adventure_contacts: [],
  last_position: [],
  ...overrides,
});

const setup = () => {
  const storage = memoryStorage();
  const now = () => new Date('2026-10-17T15:00:00Z');
  createAdventureCache(storage, now).save(row({}));
  const world = { signal: false };
  const ended = row({ stage: 'ended', checked_in_at: '2026-10-17T15:00:00Z', ended_at: '2026-10-17T15:10:00Z' });
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: ended, error: null }),
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    rpc: async () => (world.signal ? { data: null, error: null } : { data: null, error: { message: 'Network request failed' } }),
    from: () => query,
  } as unknown as SupabaseClient<Database>;
  const location: LocationService = {
    backgroundPermitted: async () => true,
    requestBackground: async () => true,
    startUpdates: async () => undefined,
    stopUpdates: async () => undefined,
    setFence: async () => undefined,
    lastReading: async () => null,
  };
  const barry = createBarry({
    supabase,
    readPosition: async () => null,
    timeZone: () => 'Europe/Zurich',
    now,
    storage,
    pushPermitted: async () => true,
    location,
  });
  return { barry, world };
};

describe('flushPendingCheckIns', () => {
  it('forgets the Ended Adventure once the queued Check-in is accepted, so the Trail stops', async () => {
    const { barry, world } = setup();
    expect(await barry.checkIn(a1)).toMatchObject({ kind: 'queued' });
    expect(await barry.trail.status()).toBe('delivering');

    world.signal = true;
    await barry.flushPendingCheckIns();
    expect(barry.pendingCheckIns()).toEqual([]);
    expect(await barry.trail.status()).toBe('off');
  });
});
