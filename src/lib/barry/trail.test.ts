import { describe, expect, it } from '@jest/globals';

import { createTrail, type LocationService, type RecordTrailResponse, type TrailFacts, trailMode } from './trail';
import { createTrailBuffer } from './trail-buffer';
import type { AdventureId, Position, RawLocation, TrailStatus } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const a1 = 'a1' as AdventureId;
const a2 = 'a2' as AdventureId;
const here: Position = { takenAt: new Date('2026-10-15T09:00:00Z'), latitude: 47.0286, longitude: 8.6885, accuracyM: 5 };
const fix = (iso: string, latitude: number): RawLocation => ({
  timestamp: new Date(iso).getTime(),
  coords: { latitude, longitude: 8.6885, accuracy: 8 },
});

type World = {
  permitted?: boolean;
  inProgress?: AdventureId | null;
  queued?: boolean;
  fenceFails?: boolean;
  signal?: boolean;
  afterCheckIn?: AdventureId | null;
};

const setup = (world: World = {}) => {
  const state = {
    permitted: true,
    inProgress: a1 as AdventureId | null,
    queued: false,
    fenceFails: false,
    signal: false,
    afterCheckIn: null as AdventureId | null,
    ...world,
  };
  const os = { updates: null as TrailStatus | null, fence: null as Position | null };
  let flushes = 0;
  const location: LocationService = {
    backgroundPermitted: async () => state.permitted,
    requestBackground: async () => {
      state.permitted = true;
      return true;
    },
    startUpdates: async (mode) => {
      os.updates = mode;
    },
    stopUpdates: async () => {
      os.updates = null;
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
    pendingCheckIn: () => state.queued,
    flushCheckIns: async () => {
      flushes += 1;
      if (!state.signal) return;
      state.queued = false;
      state.inProgress = state.afterCheckIn;
    },
    recordTrail: async (id, batch) => {
      uploads.push({ id, latitudes: batch.map((r) => r.latitude) });
      return response;
    },
  });
  const respond = (next: RecordTrailResponse) => {
    response = next;
  };
  return { trail, state, os, uploads, buffer, respond, flushes: () => flushes };
};

describe('trailMode', () => {
  const facts: TrailFacts = { signedIn: true, permitted: true, pendingCheckIn: false, inProgressId: a1 };

  it.each<[Partial<TrailFacts>, TrailStatus]>([
    [{}, 'recording'],
    [{ pendingCheckIn: true }, 'delivering'],
    [{ pendingCheckIn: true, inProgressId: null }, 'delivering'],
    [{ inProgressId: null }, 'off'],
    [{ permitted: false }, 'off'],
    [{ permitted: false, pendingCheckIn: true }, 'off'],
    [{ signedIn: false }, 'off'],
    [{ signedIn: false, pendingCheckIn: true }, 'off'],
  ])('%j gives %s', (change, mode) => {
    expect(trailMode({ ...facts, ...change })).toBe(mode);
  });
});

describe('the Trail', () => {
  it('records while an Adventure is in progress and Always is granted', async () => {
    const { trail, os } = setup();
    expect(await trail.sync()).toBe('recording');
    expect(await trail.sync()).toBe('recording');
    expect(os).toEqual({ updates: 'recording', fence: here });
  });

  it('stays off without the Always permission', async () => {
    const { trail, os } = setup({ permitted: false });
    expect(await trail.sync()).toBe('off');
    expect(os.updates).toBeNull();
  });

  it('stops once the Adventure is no longer in progress', async () => {
    const { trail, state, os } = setup();
    await trail.sync();
    state.inProgress = null;
    expect(await trail.sync()).toBe('off');
    expect(os).toEqual({ updates: null, fence: null });
  });

  it('switches to delivering once a Check-in is queued, and clears the fence and the readings', async () => {
    const { trail, state, os, buffer } = setup();
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    state.queued = true;
    expect(await trail.sync()).toBe('delivering');
    expect(await trail.status()).toBe('delivering');
    expect(os).toEqual({ updates: 'delivering', fence: null });
    expect(buffer.newest(a1)).toBeNull();
  });

  it('leaves the updates off for a queued Check-in without the Always permission', async () => {
    const { trail, os } = setup({ permitted: false, queued: true });
    expect(await trail.sync()).toBe('off');
    expect(os.updates).toBeNull();
  });

  it('tries the queued Check-in on every wake and buffers no readings while there is no signal', async () => {
    const { trail, os, uploads, buffer, flushes } = setup({ queued: true });
    await trail.sync();
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    await trail.onLocations([fix('2026-10-15T09:02:05Z', 47.031)]);
    expect(flushes()).toBe(2);
    expect(uploads).toEqual([]);
    expect(buffer.newest(a1)).toBeNull();
    expect(os).toEqual({ updates: 'delivering', fence: null });
  });

  it('stops the updates once a wake delivers the Check-in', async () => {
    const { trail, state, os, uploads } = setup({ queued: true });
    await trail.sync();
    state.signal = true;
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    expect(os).toEqual({ updates: null, fence: null });
    expect(uploads).toEqual([]);
  });

  it('records again once a wake delivers the Check-in and another Adventure is in progress', async () => {
    const { trail, state, os } = setup({ queued: true, afterCheckIn: a2 });
    await trail.sync();
    state.signal = true;
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    expect(os).toEqual({ updates: 'recording', fence: here });
    expect(await trail.status()).toBe('recording');
  });

  it('tries the queued Check-in when iOS relaunches Barry for the fence', async () => {
    const { trail, state, os, flushes } = setup({ queued: true, signal: true });
    await trail.onFenceExit();
    expect(flushes()).toBe(1);
    expect(state.queued).toBe(false);
    expect(os).toEqual({ updates: null, fence: null });
  });

  it('uploads the background readings, one per minute', async () => {
    const { trail, uploads } = setup();
    await trail.onLocations([fix('2026-10-15T09:01:01Z', 47.03), fix('2026-10-15T09:01:40Z', 47.031), fix('2026-10-15T09:02:05Z', 47.032)]);
    expect(uploads).toEqual([{ id: 'a1', latitudes: [47.03, 47.032] }]);
  });

  it('records and uploads when iOS refuses the fence', async () => {
    const { trail, os, uploads } = setup({ fenceFails: true });
    expect(await trail.sync()).toBe('recording');
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    await trail.onLocations([fix('2026-10-15T09:02:05Z', 47.032)]);
    expect(os).toMatchObject({ updates: 'recording', fence: null });
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
    os.updates = 'recording';
    await trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)]);
    expect(uploads).toEqual([]);
    expect(os.updates).toBeNull();
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
    expect(os.updates).toBe('recording');
  });

  it('never throws from a task', async () => {
    const { trail } = setup({ fenceFails: true });
    await expect(trail.onLocations([fix('2026-10-15T09:01:05Z', 47.03)])).resolves.toBeUndefined();
    await expect(trail.onFenceExit()).resolves.toBeUndefined();
  });
});
