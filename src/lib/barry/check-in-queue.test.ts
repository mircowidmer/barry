import { describe, expect, it } from '@jest/globals';

import { createCheckInQueue, type PendingCheckIn, type SendOutcome } from './check-in-queue';
import type { AdventureId } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const id = (value: string) => value as AdventureId;
const at = new Date('2026-10-17T16:05:00Z');

describe('the offline Check-in queue', () => {
  it('keeps a Check-in that could not be sent, and sends it on the next flush', async () => {
    const storage = memoryStorage();
    let signal = false;
    const sent: string[] = [];
    const queue = createCheckInQueue(storage, async (c) => {
      if (!signal) return 'no_signal';
      sent.push(c.adventureId);
      return 'accepted';
    });

    queue.add({ adventureId: id('a1'), checkedInAt: at });
    expect([...(await queue.flush())]).toEqual([]);
    expect(queue.pending()).toEqual([{ adventureId: 'a1', checkedInAt: at }]);

    signal = true;
    expect([...(await queue.flush())]).toEqual(['a1']);
    expect(sent).toEqual(['a1']);
    expect(queue.pending()).toEqual([]);
  });

  it('survives an app restart, because it lives in storage', async () => {
    const storage = memoryStorage();
    createCheckInQueue(storage, async () => 'no_signal').add({ adventureId: id('a1'), checkedInAt: at });

    const afterRestart = createCheckInQueue(storage, async () => 'accepted');
    expect(afterRestart.pending()).toEqual([{ adventureId: 'a1', checkedInAt: at }]);
    expect([...(await afterRestart.flush())]).toEqual(['a1']);
  });

  it('drops a Check-in the server refuses for good, so it does not retry forever', async () => {
    const queue = createCheckInQueue(memoryStorage(), async () => 'refused');
    queue.add({ adventureId: id('a1'), checkedInAt: at });
    expect([...(await queue.flush())]).toEqual(['a1']);
    expect(queue.pending()).toEqual([]);
  });

  it('shares one run between concurrent flushes, so a Check-in is sent once', async () => {
    let calls = 0;
    let release: (outcome: SendOutcome) => void = () => undefined;
    const queue = createCheckInQueue(memoryStorage(), (_: PendingCheckIn) => {
      calls += 1;
      return new Promise<SendOutcome>((resolve) => {
        release = resolve;
      });
    });
    queue.add({ adventureId: id('a1'), checkedInAt: at });

    const first = queue.flush();
    const second = queue.flush();
    release('accepted');
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  it('keeps one Check-in per Adventure, the latest', () => {
    const queue = createCheckInQueue(memoryStorage(), async () => 'no_signal');
    queue.add({ adventureId: id('a1'), checkedInAt: at });
    const later = new Date('2026-10-17T16:10:00Z');
    queue.add({ adventureId: id('a1'), checkedInAt: later });
    expect(queue.pending()).toEqual([{ adventureId: 'a1', checkedInAt: later }]);
  });
});
