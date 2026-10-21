import { describe, expect, it } from '@jest/globals';

import { createArrival } from './arrival';
import type { AdventureId, InProgressAdventure } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const a1 = 'a1' as AdventureId;
const a2 = 'a2' as AdventureId;
const adventure = (id: AdventureId) => ({ id, stage: 'active', plan: { destination: 'Pilatus' } }) as InProgressAdventure;

const setup = ({ live = adventure(a1) as InProgressAdventure | null, queued = false, storage = memoryStorage() } = {}) => {
  const shown: AdventureId[] = [];
  const world = { live, queued };
  const arrival = createArrival({
    storage,
    show: async (a) => void shown.push(a.id),
    inProgress: () => world.live,
    checkedIn: () => world.queued,
  });
  return { arrival, shown, world, storage };
};

describe('the Arrival Notice', () => {
  it('shows once per Adventure, also after a relaunch', async () => {
    const { arrival, shown, world, storage } = setup();
    await arrival.arrived(a1);
    await arrival.arrived(a1);
    await setup({ storage }).arrival.arrived(a1);
    expect(shown).toEqual(['a1']);
    world.live = adventure(a2);
    await arrival.arrived(a2);
    expect(shown).toEqual(['a1', 'a2']);
  });

  it('shows nothing for an Adventure that is no longer in progress, or once the Check-in is queued', async () => {
    const other = setup({ live: adventure(a2) });
    await other.arrival.arrived(a1);
    expect(other.shown).toEqual([]);
    const queued = setup({ queued: true });
    await queued.arrival.arrived(a1);
    expect(queued.shown).toEqual([]);
  });

  it('tries again on the next report when the phone could not show it', async () => {
    const storage = memoryStorage();
    const failing = createArrival({
      storage,
      show: async () => {
        throw new Error('notifications unavailable');
      },
      inProgress: () => adventure(a1),
      checkedIn: () => false,
    });
    await expect(failing.arrived(a1)).rejects.toThrow();
    const { arrival, shown } = setup({ storage });
    await arrival.arrived(a1);
    expect(shown).toEqual(['a1']);
  });
});
