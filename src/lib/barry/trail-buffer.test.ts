import { describe, expect, it } from '@jest/globals';

import { createTrailBuffer, slotKey, type TrailSendOutcome } from './trail-buffer';
import type { AdventureId, Position } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const id = (value: string) => value as AdventureId;
const reading = (iso: string, latitude = 47): Position => ({ takenAt: new Date(iso), latitude, longitude: 8.6, accuracyM: 10 });
const every = (seconds: number) => (from: string, count: number) =>
  Array.from({ length: count }, (_, i) => reading(new Date(new Date(from).getTime() + i * seconds * 1000).toISOString()));
const slots = every(300);

const recorder = (outcomes: TrailSendOutcome[] = []) => {
  const sent: { adventureId: string; times: string[] }[] = [];
  const send = async (adventureId: AdventureId, batch: readonly Position[]) => {
    sent.push({ adventureId, times: batch.map((r) => r.takenAt.toISOString()) });
    return outcomes.shift() ?? 'accepted';
  };
  return { sent, send };
};

describe('the Trail buffer', () => {
  it('buckets by the UTC five minutes', () => {
    expect(slotKey(reading('2026-10-15T09:40:00.000Z'))).toBe('2026-10-15T09:40');
    expect(slotKey(reading('2026-10-15T09:44:59.900Z'))).toBe('2026-10-15T09:40');
    expect(slotKey(reading('2026-10-15T09:45:00.000Z'))).toBe('2026-10-15T09:45');
  });

  it('keeps the first reading of each five minutes', () => {
    const buffer = createTrailBuffer(memoryStorage());
    buffer.add(id('a1'), [reading('2026-10-15T09:41:11Z', 47.1), reading('2026-10-15T09:41:49Z', 47.2)]);
    buffer.add(id('a1'), [reading('2026-10-15T09:41:30Z', 47.3)]);
    expect(buffer.newest(id('a1'))).toEqual(reading('2026-10-15T09:41:11Z', 47.1));
  });

  it('sends nothing for a reading in five minutes it already sent', async () => {
    const storage = memoryStorage();
    const { sent, send } = recorder();
    createTrailBuffer(storage).add(id('a1'), [reading('2026-10-15T09:41:11Z')]);
    await createTrailBuffer(storage).flush(send);
    const buffer = createTrailBuffer(storage);
    buffer.add(id('a1'), [reading('2026-10-15T09:44:40Z'), reading('2026-10-15T09:38:05Z')]);
    await buffer.flush(send);
    buffer.add(id('a1'), [reading('2026-10-15T09:45:10Z')]);
    await buffer.flush(send);
    expect(sent.map((s) => s.times)).toEqual([['2026-10-15T09:41:11.000Z'], ['2026-10-15T09:45:10.000Z']]);
  });

  it('sends oldest first in batches of 200 and stops at the first retry', async () => {
    const buffer = createTrailBuffer(memoryStorage());
    buffer.add(id('a1'), slots('2026-10-15T08:00:00Z', 250));
    const { sent, send } = recorder(['accepted', 'retry']);
    await buffer.flush(send);
    expect(sent.map((s) => [s.times.length, s.times[0]])).toEqual([
      [200, '2026-10-15T08:00:00.000Z'],
      [50, '2026-10-16T00:40:00.000Z'],
    ]);

    const again = recorder();
    await buffer.flush(again.send);
    expect(again.sent.map((s) => [s.times.length, s.times[0]])).toEqual([[50, '2026-10-16T00:40:00.000Z']]);
    expect(buffer.newest(id('a1'))).toBeNull();
  });

  it('drops the readings of an Adventure the server refuses', async () => {
    const buffer = createTrailBuffer(memoryStorage());
    buffer.add(id('a1'), slots('2026-10-15T08:00:00Z', 250));
    const { sent, send } = recorder(['refused']);
    await buffer.flush(send);
    expect(sent).toHaveLength(1);
    expect(buffer.newest(id('a1'))).toBeNull();
  });

  it('shares one run between concurrent flushes, so a batch is sent once', async () => {
    const buffer = createTrailBuffer(memoryStorage());
    buffer.add(id('a1'), [reading('2026-10-15T09:41:10Z')]);
    let calls = 0;
    let release: (outcome: TrailSendOutcome) => void = () => undefined;
    const send = () => {
      calls += 1;
      return new Promise<TrailSendOutcome>((resolve) => {
        release = resolve;
      });
    };
    const first = buffer.flush(send);
    const second = buffer.flush(send);
    release('accepted');
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  it('evicts the oldest readings beyond a day of them', async () => {
    const buffer = createTrailBuffer(memoryStorage());
    buffer.add(id('a1'), slots('2026-10-15T00:00:00Z', 289));
    const { sent, send } = recorder();
    await buffer.flush(send);
    expect(sent.flatMap((s) => s.times)).toHaveLength(288);
    expect(sent[0]?.times[0]).toBe('2026-10-15T00:05:00.000Z');
  });

  it('forgets every other Adventure', () => {
    const buffer = createTrailBuffer(memoryStorage());
    buffer.add(id('old'), [reading('2026-10-14T09:00:00Z')]);
    buffer.add(id('a1'), [reading('2026-10-15T09:00:00Z')]);
    buffer.keepOnly(id('a1'));
    expect(buffer.newest(id('old'))).toBeNull();
    expect(buffer.newest(id('a1'))).not.toBeNull();
    buffer.keepOnly(null);
    expect(buffer.newest(id('a1'))).toBeNull();
  });
});
