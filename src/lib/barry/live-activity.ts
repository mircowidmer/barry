import { serialized } from './serialized';
import type { InProgressAdventure } from './types';

/** What the Live Activity on the Lock Screen shows: the live Adventure until the Adventurer checks in. */
export type LiveActivityView = { destination: string; startedAt: Date; deadline: Date };

export type LiveActivityService = {
  /** Starts, updates or ends the Live Activity so it shows `view`, or nothing for null. */
  show(view: LiveActivityView | null): Promise<void>;
};

export const liveActivityView = (adventure: InProgressAdventure | null, checkedIn: boolean): LiveActivityView | null =>
  adventure && !checkedIn
    ? { destination: adventure.plan.destination, startedAt: adventure.startedAt, deadline: adventure.deadline }
    : null;

type LiveActivityDeps = {
  service: LiveActivityService;
  due: () => LiveActivityView | null;
  /** What the texts depend on besides the view: the day, which decides whether the Deadline names its day, and the language. */
  textContext: () => string;
};

export const createLiveActivity = ({ service, due, textContext }: LiveActivityDeps) => {
  // Every refetch of the live Adventure syncs, and the view rarely changes, so only a change reaches iOS.
  let shown: string | null = null;
  return {
    /** Brings the Live Activity in line with `due()`. Idempotent. */
    sync: serialized(async () => {
      const view = due();
      const key = JSON.stringify([view, textContext()]);
      if (key === shown) return;
      await service.show(view);
      shown = key;
    }),
  };
};
