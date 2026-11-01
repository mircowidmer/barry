import { serialized } from './serialized';
import type { AdventureId, InProgressAdventure, SentMessage } from './types';

const REMINDER_LEAD_MS = 30 * 60_000;

const PREFIX = 'barry.';

type AlarmKind = 'reminder' | 'overdue_notice';

/** A notification the phone shows by itself, so it needs neither signal nor push. */
export type Alarm = { identifier: string; kind: AlarmKind; at: Date; adventure: InProgressAdventure };

export type NotificationService = {
  scheduledIdentifiers(): Promise<string[]>;
  /** Replaces any scheduled notification with the same identifier. */
  schedule(alarm: Alarm): Promise<void>;
  cancel(identifier: string): Promise<void>;
  /** Shows the Arrival Notice at once, outside the scheduled ones. */
  showArrival(adventure: InProgressAdventure): Promise<void>;
  /** Shows at once that a text message to a contact of the Adventure was not delivered. */
  showDeliveryFailure(message: SentMessage, adventureId: AdventureId): Promise<void>;
};

const alarm = (kind: AlarmKind, at: Date, adventure: InProgressAdventure): Alarm => ({
  identifier: `${PREFIX}${kind}.${adventure.id}`,
  kind,
  at,
  adventure,
});

/**
 * The Reminder and the Overdue Notice still ahead of `now`. A Deadline set less than 30 minutes
 * ahead puts the Reminder in the past, so it is left out here, which is how Barry skips it.
 */
export const dueAlarms = (adventure: InProgressAdventure | null, checkedIn: boolean, now: Date): Alarm[] => {
  if (!adventure || checkedIn) return [];
  return [
    alarm('reminder', new Date(adventure.deadline.getTime() - REMINDER_LEAD_MS), adventure),
    alarm('overdue_notice', adventure.deadline, adventure),
  ].filter((a) => a.at > now);
};

export const createAlarms = ({ notifications, due }: { notifications: NotificationService; due: () => Alarm[] }) => {
  const apply = async () => {
    const wanted = due();
    const keep = new Set(wanted.map((a) => a.identifier));
    const stale = (await notifications.scheduledIdentifiers()).filter((id) => id.startsWith(PREFIX) && !keep.has(id));
    await Promise.all([...stale.map(notifications.cancel), ...wanted.map(notifications.schedule)]);
  };

  return {
    /** Brings the scheduled notifications in line with `due()`. Idempotent. */
    sync: serialized(apply),
  };
};
