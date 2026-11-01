import type { AdventureId, InProgressAdventure } from './types';

const KEY = 'barry.arrivalNoticeShown';

type ArrivalDeps = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Shows the Arrival Notice on the phone at once. Needs neither signal nor push. */
  show(adventure: InProgressAdventure): Promise<void>;
  inProgress(): InProgressAdventure | null;
  checkedIn(id: AdventureId): boolean;
};

/**
 * The Arrival Notice, at most once per Adventure. iOS reports the destination's region again each
 * time the fences are set, and an Adventurer can walk in and out of it.
 */
export const createArrival = ({ storage, show, inProgress, checkedIn }: ArrivalDeps) => ({
  arrived: async (id: AdventureId) => {
    const adventure = inProgress();
    if (adventure?.id !== id || checkedIn(id) || storage.getItem(KEY) === id) return;
    await show(adventure);
    storage.setItem(KEY, id);
  },
});
