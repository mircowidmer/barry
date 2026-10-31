import type { AdventureId, InProgressAdventure, SentMessage } from './types';

const KEY = 'barry.failureNoticesShown';

type Shown = { adventureId: AdventureId; ids: number[] };

export type FailureNoticesDeps = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Shows the notice on the phone at once. Needs neither push nor the app in front. */
  show(message: SentMessage, adventureId: AdventureId): Promise<void>;
  inProgress(): InProgressAdventure | null;
  messages(id: AdventureId): Promise<SentMessage[]>;
};

/**
 * One notice for each text message Twilio reported not delivered, however Barry learns of it: Realtime while open,
 * a Trail wake in the background, or coming to the front. After the Check-in it keeps looking at the last
 * Adventure, because an All-clear goes out then.
 */
export const createFailureNotices = ({ storage, show, inProgress, messages }: FailureNoticesDeps) => {
  const load = (): Shown | null => {
    try {
      return JSON.parse(storage.getItem(KEY) ?? 'null') as Shown | null;
    } catch {
      return null;
    }
  };

  const notice = async () => {
    const stored = load();
    const adventureId = inProgress()?.id ?? stored?.adventureId;
    if (!adventureId) return;
    const shown = new Set(stored?.adventureId === adventureId ? stored.ids : []);
    const save = () => storage.setItem(KEY, JSON.stringify({ adventureId, ids: [...shown] } satisfies Shown));
    save();
    for (const message of await messages(adventureId)) {
      if (!message.undelivered || shown.has(message.id)) continue;
      await show(message, adventureId);
      shown.add(message.id);
      save();
    }
  };

  // One at a time, so a Realtime event and a foreground arriving together cannot show the same notice twice.
  let last: Promise<void> = Promise.resolve();
  return {
    notice: () => (last = last.catch(() => undefined).then(notice)),
  };
};
