import { describe, expect, it } from '@jest/globals';

import type { AdventureId, Alarm, InProgressAdventure } from '@/lib/barry';

import { notificationText } from './wording';

const adventure = {
  id: 'a1' as AdventureId,
  stage: 'active',
  contacts: [],
  plan: { destination: 'Pilatus', route: null, startingPoint: null, notes: null },
  deadline: new Date('2026-10-17T16:00:00Z'),
  alertAt: new Date('2026-10-17T16:01:00Z'),
  timeZone: 'Europe/Zurich',
  startedAt: new Date('2026-10-17T06:00:00Z'),
  lastKnownPosition: null,
} as InProgressAdventure;

const alarm = (kind: Alarm['kind']): Alarm => ({ identifier: `barry.${kind}.a1`, kind, at: adventure.deadline, adventure });

describe('notificationText', () => {
  it('words the Reminder like the server did, in the time zone of the Start', () => {
    expect(notificationText(alarm('reminder'))).toEqual({
      title: 'Check in or move your Deadline',
      body: 'Your Deadline for Pilatus is Sat 17 Oct, 18:00.',
    });
  });

  it('gives the Alert time in the Overdue Notice', () => {
    expect(notificationText(alarm('overdue_notice'))).toEqual({
      title: 'You are overdue',
      body: 'Your Deadline for Pilatus was Sat 17 Oct, 18:00. Barry alerts your emergency contacts at Sat 17 Oct, 18:01 unless you check in.',
    });
  });
});
