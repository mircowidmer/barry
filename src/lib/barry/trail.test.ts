import { describe, expect, it } from '@jest/globals';

import { createTrail, type LocationService, type RecordTrailResponse } from './trail';
import { createTrailBuffer } from './trail-buffer';
import type { AdventureId, Position, RawLocation } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const a1 = 'a1' as AdventureId;
const here: Position = { takenAt: new Date('2026-10-15T09:00:00Z'), latitude: 47.0286, longitude: 8.6885, accuracyM: 5 };
const fix = (iso: string, latitude: number): RawLocation => ({
  timestamp: new Date(iso).getTime(),
  coords: { latitude, longitude: 8.6885, accuracy: 8 },
});

type World = { permitted?: boolean; inProgress?: AdventureId | null; queued?: boolean; fenceFails?: boolean };

const setup = (world: World = {}) => {
  const state = { permitted: true, inProgress: a1 as AdventureId | null, queued: false, fenceFails: false, ...world };
  const os = { updates: false, fence: null as Position | null, starts: 0 };
  const location: LocationService = {
    backgroundPermitted: async () => state.permitted,
    requestBackground: async () => {
      state.permitted = true;
      return true;
    },
    startUpdates: async () => {
      if (!os.updates) os.starts += 1;
      os.updates = true;
    },
    stopUpdates: async () => {
      os.updates = false;
    },
    setFence: async (center) => {
      if (state.fenceFails) throw new Error('kCLErrorDomain');
      os.fence = center;
    },
    lastReading: async () => here,
  };
  const uploads: { id: string; latitudes: number[] }[] = [];
  let response: RecordTrailResponse = { data: null, error: null };
  const buffer = createTrailBuffer(memoryStorage());
  const trail = createTrail({
    location,
    buffer,
    signedIn: async () => true,
    inProgressId: () => state.inProgress,
    checkInQueued: () => state.queued,
    recordTrail: async (id, batch) => {
      uploads.push({ id, latitudes: batch.map((r) => r.latitude) });
      return response;
    },
  });
  const respond = (next: RecordTrailResponse) => {
    response = next;
  };
  return { trail, state, os, uploads, buffer, respond };
};

describe('the Trail', () => {
  it('records while an Adventure is in progress and Always is granted, and starts the OS updates once', async () => {
    const { trail, os } = setup();
    expect(await trail.sync()).toBe('recording');
    expect(await trail.sync()).toBe('recording');
    expect(os).toEqual({ updates: true, fence: here, starts: 1 });
  });

  it('stays off without the Always permission', async () => {
    const { trail, os } = setup({ permitted: false });
    expect(await trail.sync()).toBe('off');
    expect(os.updates).toBe(false);
  });

  it('stops once a Check-in is queued, and once the Adventure is no longer in progress', async () => {
    const { trail, state, os } = setup();
    await trail.sync();
    state.queued = true;
    expect(await trail.sync()).toBe('off');
    expect(os).toMatchObject({ updates: false, fence: null });

    state.queued = false;
    state.inProgress = null;
    expect(await trail.status()).toBe('off');
  });

  it('uploads the background readings, one per minute', async () => {
    const { trail, uploads } = setup();
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03), fix('2026-10-15T09:01:40Z', 47.031), fix('2026-10-15T09:02:05Z', 47.032)]);
    expect(uploads).toEqual([{ id: 'a1', latitudes: [47.03, 47.032] }]);
  });

  it('records and uploads when iOS refuses the fence', async () => {
    const { trail, os, uploads } = setup({ fenceFails: true });
    expect(await trail.sync()).toBe('recording');
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    await trail.onLocations([fix('2026-10-15T09:02:05Z', 47.032)]);
    expect(os).toMatchObject({ updates: true, fence: null });
    expect(uploads).toEqual([
      { id: 'a1', latitudes: [47.03] },
      { id: 'a1', latitudes: [47.032] },
    ]);
  });

  it('keeps the readings when the session cannot be refreshed, and sends them later', async () => {
    const { trail, uploads, respond } = setup();
    respond({ data: null, error: { message: 'JWT expired' } });
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    respond({ data: null, error: null });
    await trail.onLocations([fix('2026-10-15T09:02:05Z', 47.04)]);
    expect(uploads).toEqual([
      { id: 'a1', latitudes: [47.03] },
      { id: 'a1', latitudes: [47.03, 47.04] },
    ]);
  });

  it('drops the readings once the server refuses them', async () => {
    const { trail, buffer, respond } = setup();
    respond({ data: 'wrong_stage', error: null });
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    expect(buffer.newest(a1)).toBeNull();
  });

  it('buffers nothing and stops when no Adventure is in progress', async () => {
    const { trail, os, uploads } = setup({ inProgress: null });
    os.updates = true;
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    expect(uploads).toEqual([]);
    expect(os.updates).toBe(false);
  });

  it('moves the fence to the newest reading once the Adventurer has walked away from it', async () => {
    const { trail, os } = setup();
    await trail.sync();
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.0287)]);
    expect(os.fence?.latitude).toBe(47.0286);
    await trail.onLocations([fix('2026-10-15T09:02:05Z', 47.03)]);
    expect(os.fence?.latitude).toBe(47.03);
  });

  it('takes a reading and records again after iOS relaunches Barry for the fence', async () => {
    const { trail, os, uploads } = setup();
    await trail.onFenceExit();
    expect(uploads).toEqual([{ id: 'a1', latitudes: [47.0286] }]);
    expect(os.updates).toBe(true);
  });

  it('never throws from a task', async () => {
    const { trail } = setup({ fenceFails: true });
    await expect(trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)])).resolves.toBeUndefined();
    await expect(trail.onFenceExit()).resolves.toBeUndefined();
  });
});
