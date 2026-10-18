import { describe, expect, it } from '@jest/globals';
import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

import { createAdventureCache } from './adventure-cache';
import type { NotificationService } from './alarms';
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
  deadline: '2026-10-17T16:00:00Z',
  alert_at: '2026-10-17T16:30:00Z',
  deadline_set_at: '2026-10-17T06:00:00Z',
  time_zone: 'Europe/Zurich',
  started_at: '2026-10-17T06:00:00Z',
  alerts_sent: 0,
  plan_revision: 0,
  last_alert_at: null,
  checked_in_at: null,
  ended_at: null,
  created_at: '2026-10-15T08:00:00Z',
  updated_at: '2026-10-15T08:00:00Z',
  adventure_contacts: [],
  last_position: [],
  ...overrides,
});

const setup = ({ cached = true } = {}) => {
  const storage = memoryStorage();
  const now = () => new Date('2026-10-17T15:00:00Z');
  if (cached) createAdventureCache(storage, now).save(row({}));
  const ended = row({ stage: 'ended', checked_in_at: '2026-10-17T15:00:00Z', ended_at: '2026-10-17T15:10:00Z' });
  const world = {
    signal: false,
    reads: true,
    server: ended,
    session: { data: { session: { user: { id: 'u1' } } }, error: null } as { data: { session: unknown }; error: unknown },
  };
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () =>
      world.signal && world.reads ? { data: world.server, error: null } : { data: null, error: { message: 'Network request failed' } },
  };
  const signOuts: unknown[] = [];
  const supabase = {
    auth: {
      getSession: async () => world.session,
      signOut: async (options: unknown) => void signOuts.push(options),
    },
    rpc: async () => (world.signal ? { data: null, error: null } : { data: null, error: { message: 'Network request failed' } }),
    from: () => query,
  } as unknown as SupabaseClient<Database>;
  const updates: string[] = [];
  const location: LocationService = {
    backgroundPermitted: async () => true,
    requestBackground: async () => true,
    startUpdates: async (mode) => void updates.push(mode),
    stopUpdates: async () => void updates.push('off'),
    setFence: async () => undefined,
    lastReading: async () => null,
  };
  const scheduled = new Map<string, string>();
  const notifications: NotificationService = {
    scheduledIdentifiers: async () => [...scheduled.keys()],
    schedule: async (alarm) => void scheduled.set(alarm.identifier, alarm.at.toISOString()),
    cancel: async (id) => void scheduled.delete(id),
  };
  const barry = createBarry({
    supabase,
    readPosition: async () => null,
    timeZone: () => 'Europe/Zurich',
    language: () => 'de',
    now,
    storage,
    notificationsPermitted: async () => true,
    notifications,
    location,
  });
  return { barry, world, updates, signOuts, scheduled: () => Object.fromEntries(scheduled) };
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

  it('forgets the Ended Adventure even when the refetch after the accepted Check-in fails', async () => {
    const { barry, world, scheduled } = setup();
    world.signal = true;
    world.reads = false;
    expect(await barry.checkIn(a1)).toMatchObject({ kind: 'queued' });
    expect(barry.pendingCheckIns()).toEqual([]);
    expect(await barry.trail.status()).toBe('off');
    expect(scheduled()).toEqual({});
  });
});

describe('signedIn', () => {
  it('keeps recording the Trail when the expired token cannot be refreshed for lack of signal', async () => {
    const { barry, world } = setup();
    world.session = { data: { session: null }, error: new AuthRetryableFetchError('Network request failed', 0) };
    expect(await barry.trail.status()).toBe('recording');
  });

  it('stops the Trail once the session is really gone', async () => {
    const { barry, world } = setup();
    world.session = { data: { session: null }, error: null };
    expect(await barry.trail.status()).toBe('off');
  });
});

describe('the Trail', () => {
  it('starts recording when Barry first learns of a live Adventure after the launch found none', async () => {
    const { barry, world, updates } = setup({ cached: false });
    await barry.trail.sync();
    expect(updates).toEqual(['off']);

    world.signal = true;
    world.server = row({});
    await barry.getInProgressAdventure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updates).toEqual(['off', 'recording']);
  });
});

describe('local notifications', () => {
  it('schedules the Reminder and the Overdue Notice without signal, and a waiting Check-in cancels both', async () => {
    const { barry, scheduled } = setup();
    await barry.getInProgressAdventure();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scheduled()).toEqual({
      'barry.reminder.a1': '2026-10-17T15:30:00.000Z',
      'barry.overdue_notice.a1': '2026-10-17T16:00:00.000Z',
    });

    expect(await barry.checkIn(a1)).toMatchObject({ kind: 'queued' });
    expect(scheduled()).toEqual({});
  });
});

describe('deleteAccount', () => {
  it('forgets the saved Adventure and signs out on this phone only', async () => {
    const { barry, world, signOuts } = setup();
    world.signal = true;
    expect(await barry.deleteAccount()).toEqual({ kind: 'deleted' });
    expect(signOuts).toEqual([{ scope: 'local' }]);
    world.signal = false;
    expect((await barry.getInProgressAdventure()).adventure).toBeNull();
  });
});
