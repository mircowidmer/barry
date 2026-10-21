import { describe, expect, it } from '@jest/globals';

import type { AdventureId, Alarm, InProgressAdventure } from '@/lib/barry';

import { arrivalText, formatDurationGerman, formatMessageTimeGerman, notificationText } from './wording';

const adventure = {
  id: 'a1' as AdventureId,
  stage: 'active',
  contacts: [],
  plan: { destination: 'Pilatus', destinationPoint: null, route: null },
  deadline: new Date('2026-10-17T16:00:00Z'),
  alertAt: new Date('2026-10-17T16:01:00Z'),
  timeZone: 'Europe/Zurich',
  startedAt: new Date('2026-10-17T06:00:00Z'),
  lastKnownPosition: null,
} as InProgressAdventure;

const alarm = (kind: Alarm['kind']): Alarm => ({ identifier: `barry.${kind}.a1`, kind, at: adventure.deadline, adventure });

describe('notificationText', () => {
  it('words the Reminder like the server did, in the time zone of the Start', () => {
    expect(notificationText(alarm('reminder'), 'en')).toEqual({
      title: 'Check in or move your deadline',
      body: 'Your deadline for Pilatus is Sat 17 Oct, 18:00.',
    });
  });

  it('gives the Alert time in the Overdue Notice', () => {
    expect(notificationText(alarm('overdue_notice'), 'en')).toEqual({
      title: 'You are overdue',
      body: 'Your deadline for Pilatus was Sat 17 Oct, 18:00. Barry alerts your emergency contacts at Sat 17 Oct, 18:01 unless you check in.',
    });
  });

  it('words both notifications in German on a German phone', () => {
    expect(notificationText(alarm('reminder'), 'de')).toEqual({
      title: 'Melde dich zurück oder verschiebe deine Rückkehrzeit',
      body: 'Deine Rückkehrzeit für Pilatus ist am Sa, 17. Okt. um 18:00.',
    });
    expect(notificationText(alarm('overdue_notice'), 'de').body).toBe(
      'Deine Rückkehrzeit für Pilatus war am Sa, 17. Okt. um 18:00. Barry alarmiert deine Notfallkontakte am Sa, 17. Okt. um 18:01, ausser du meldest dich vorher zurück.',
    );
  });
});

describe('arrivalText', () => {
  it('names the destination and asks for the Check-in once back safe, in both languages', () => {
    expect(arrivalText(adventure, 'en')).toEqual({ title: 'You have reached Pilatus', body: 'Check in once you are back safe.' });
    expect(arrivalText(adventure, 'de')).toEqual({
      title: 'Du hast Pilatus erreicht',
      body: 'Melde dich zurück, sobald du wieder in Sicherheit bist.',
    });
  });
});

describe('German formats', () => {
  it('writes the time in the Adventure’s time zone like the German messages', () => {
    expect(formatMessageTimeGerman(new Date('2026-03-02T08:05:00Z'), 'Europe/Zurich')).toBe('Mo, 2. März um 09:05');
  });

  it('writes durations with Min. and Std.', () => {
    expect(formatDurationGerman(25 * 60_000)).toBe('25 Min.');
    expect(formatDurationGerman(2 * 3600_000)).toBe('2 Std.');
    expect(formatDurationGerman(90 * 60_000)).toBe('1 Std. 30 Min.');
  });
});
