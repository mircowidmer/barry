import { describe, expect, it } from '@jest/globals';

import { type Alarm, createAlarms, dueAlarms, type NotificationService } from './alarms';
import type { AdventureId, InProgressAdventure } from './types';

const now = new Date('2026-10-17T15:00:00Z');

const adventure = (deadline: string, stage: InProgressAdventure['stage'] = 'active') =>
  ({
    id: 'a1' as AdventureId,
    stage,
    contacts: [],
    plan: { destination: 'Pilatus', destinationPoint: null },
    deadline: new Date(deadline),
    alertAt: new Date(new Date(deadline).getTime() + 60_000),
    timeZone: 'Europe/Zurich',
    startedAt: new Date('2026-10-17T06:00:00Z'),
    lastKnownPosition: null,
    alertsSent: 0,
  }) as InProgressAdventure;

const when = (alarms: Alarm[]) => alarms.map((a) => `${a.identifier} ${a.at.toISOString()}`);

describe('dueAlarms', () => {
  it('owes a Reminder 30 minutes before the Deadline and an Overdue Notice at it', () => {
    expect(when(dueAlarms(adventure('2026-10-17T17:00:00Z'), false, now))).toEqual([
      'barry.reminder.a1 2026-10-17T16:30:00.000Z',
      'barry.overdue_notice.a1 2026-10-17T17:00:00.000Z',
    ]);
  });

  it('skips the Reminder for a Deadline less than 30 minutes ahead', () => {
    expect(when(dueAlarms(adventure('2026-10-17T15:20:00Z'), false, now))).toEqual([
      'barry.overdue_notice.a1 2026-10-17T15:20:00.000Z',
    ]);
  });

  it('owes nothing once the Deadline has passed', () => {
    expect(dueAlarms(adventure('2026-10-17T14:59:00Z', 'overdue'), false, now)).toEqual([]);
  });

  it('owes nothing after a Check-in, even one still waiting for signal', () => {
    expect(dueAlarms(adventure('2026-10-17T17:00:00Z'), true, now)).toEqual([]);
  });

  it('owes nothing without a live Adventure', () => {
    expect(dueAlarms(null, false, now)).toEqual([]);
  });
});

const fakeNotifications = (initial: string[] = []) => {
  const scheduled = new Map(initial.map((id) => [id, '']));
  const service: NotificationService = {
    scheduledIdentifiers: async () => [...scheduled.keys()],
    schedule: async (a) => void scheduled.set(a.identifier, a.at.toISOString()),
    cancel: async (id) => void scheduled.delete(id),
    showArrival: async () => undefined,
    showDeliveryFailure: async () => undefined,
  };
  return { service, scheduled: () => Object.fromEntries(scheduled) };
};

describe('createAlarms', () => {
  it('schedules what is due and cancels the alarms of an Adventure that is no longer live', async () => {
    const { service, scheduled } = fakeNotifications(['barry.overdue_notice.old', 'barry.reminder.a1', 'someone-else']);
    const alarms = createAlarms({ notifications: service, due: () => dueAlarms(adventure('2026-10-17T17:00:00Z'), false, now) });

    await alarms.sync();

    expect(scheduled()).toEqual({
      'barry.reminder.a1': '2026-10-17T16:30:00.000Z',
      'barry.overdue_notice.a1': '2026-10-17T17:00:00.000Z',
      'someone-else': '',
    });
  });

  it('applies syncs in order, so a slow sync cannot reschedule what a Check-in cancelled', async () => {
    const { service, scheduled } = fakeNotifications();
    let release = () => {};
    const slowFirstRead = new Promise<void>((resolve) => (release = resolve));
    let reads = 0;
    const slow: NotificationService = {
      ...service,
      scheduledIdentifiers: async () => {
        if (reads++ === 0) await slowFirstRead;
        return service.scheduledIdentifiers();
      },
    };
    let checkedIn = false;
    const alarms = createAlarms({ notifications: slow, due: () => dueAlarms(adventure('2026-10-17T17:00:00Z'), checkedIn, now) });

    const first = alarms.sync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    checkedIn = true;
    const second = alarms.sync();
    release();
    await Promise.all([first, second]);

    expect(scheduled()).toEqual({});
  });
});
