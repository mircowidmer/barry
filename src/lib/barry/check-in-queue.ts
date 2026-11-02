import type { AdventureId } from './types';

export type PendingCheckIn = { adventureId: AdventureId; checkedInAt: Date };

/** What sending one Check-in did: accepted, refused for good, or no signal. */
export type SendOutcome = 'accepted' | 'refused' | 'no_signal';

type CheckInQueue = {
  /** Saves the Check-in before anything is sent, so a crash after the gesture keeps it. */
  add(checkIn: PendingCheckIn): void;
  pending(): PendingCheckIn[];
  /** Sends every pending Check-in. Concurrent callers share one run. Returns the ids that left the queue. */
  flush(): Promise<Set<AdventureId>>;
};

const KEY = 'barry.pendingCheckIns';

export const createCheckInQueue = (
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  send: (checkIn: PendingCheckIn) => Promise<SendOutcome>,
): CheckInQueue => {
  const read = (): PendingCheckIn[] => {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as { adventureId: string; checkedInAt: string }[]).map((c) => ({
      adventureId: c.adventureId as AdventureId,
      checkedInAt: new Date(c.checkedInAt),
    }));
  };
  const write = (items: PendingCheckIn[]) =>
    storage.setItem(
      KEY,
      JSON.stringify(items.map((c) => ({ adventureId: c.adventureId, checkedInAt: c.checkedInAt.toISOString() }))),
    );

  let running: Promise<Set<AdventureId>> | null = null;

  const run = async () => {
    const done = new Set<AdventureId>();
    for (const checkIn of read()) {
      const outcome = await send(checkIn);
      if (outcome === 'no_signal') break;
      done.add(checkIn.adventureId);
      write(read().filter((c) => c.adventureId !== checkIn.adventureId));
    }
    return done;
  };

  return {
    add: (checkIn) => write([...read().filter((c) => c.adventureId !== checkIn.adventureId), checkIn]),
    pending: read,
    flush: () => {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
  };
};
