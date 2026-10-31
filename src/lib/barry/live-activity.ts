import { serialized } from './serialized';
import type { AdventureId, InProgressAdventure } from './types';

/** What the Live Activity on the Lock Screen shows: the live Adventure until the Adventurer checks in. */
export type LiveActivityView = { adventureId: AdventureId; destination: string; startedAt: Date; deadline: Date };

export type LiveActivityService = {
  /** Starts, updates or ends the Live Activity so it shows `view`, or nothing for null. */
  show(view: LiveActivityView | null): Promise<void>;
};

const CHECK_IN_TARGET = 'check-in:';

export const liveActivityView = (adventure: InProgressAdventure | null, checkedIn: boolean): LiveActivityView | null =>
  adventure && !checkedIn
    ? { adventureId: adventure.id, destination: adventure.plan.destination, startedAt: adventure.startedAt, deadline: adventure.deadline }
    : null;

/** The target of the Check In button names its Adventure, so a tap on a stale Live Activity cannot check in another one. */
export const checkInTarget = (id: AdventureId) => `${CHECK_IN_TARGET}${id}`;

export const checkInTargetId = (target: string): AdventureId | null =>
  target.startsWith(CHECK_IN_TARGET) && target.length > CHECK_IN_TARGET.length
    ? (target.slice(CHECK_IN_TARGET.length) as AdventureId)
    : null;

export const createLiveActivity = ({ service, due }: { service: LiveActivityService; due: () => LiveActivityView | null }) => {
  // Every refetch of the live Adventure syncs, and the view rarely changes, so only a change reaches iOS.
  let shown: string | null = null;
  return {
    /** Brings the Live Activity in line with `due()`. Idempotent. */
    sync: serialized(async () => {
      const view = due();
      const key = JSON.stringify(view);
      if (key === shown) return;
      await service.show(view);
      shown = key;
    }),
  };
};
