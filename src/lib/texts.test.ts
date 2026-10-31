import { describe, expect, it } from '@jest/globals';

import type { EmergencyContactId, SentMessage } from '@/lib/barry';

import { liveActivityText, texts } from './texts';

describe('the Conditions', () => {
  it('say in both languages when the Deadline is after Dark, when no rain or snow is expected and when the forecast reaches the Adventure Day', () => {
    expect(texts.en.plan.afterDark('Thu 29 Oct at 17:47')).toBe('Your deadline is after dark, which falls at Thu 29 Oct at 17:47 at your destination.');
    expect(texts.de.plan.afterDark('Do, 29. Okt. um 17:47')).toBe(
      'Deine Rückkehrzeit liegt nach Einbruch der Dunkelheit, die an deinem Ziel um Do, 29. Okt. um 17:47 beginnt.',
    );
    expect(texts.en.conditions.dry(null)).toBe('No rain or snow expected today.');
    expect(texts.en.conditions.dry('Sat 31 Oct')).toBe('No rain or snow expected on Sat 31 Oct.');
    expect(texts.de.conditions.dry(null)).toBe('Heute ist kein Niederschlag zu erwarten.');
    expect(texts.de.conditions.dry('Sa, 31. Okt.')).toBe('Am Sa, 31. Okt. ist kein Niederschlag zu erwarten.');
    expect(texts.en.conditions.forecastFrom('Mon 2 Nov at 06:00', 'Sat 7 Nov')).toBe('The forecast reaches Sat 7 Nov from Mon 2 Nov at 06:00.');
    expect(texts.de.conditions.forecastFrom('Mo, 2. Nov. um 06:00', 'Sa, 7. Nov.')).toBe('Die Prognose reicht bis Sa, 7. Nov. ab Mo, 2. Nov. um 06:00.');
    expect(texts.en.weekday(new Date(2026, 9, 31))).toBe('Sat');
    expect(texts.de.weekday(new Date(2026, 9, 31))).toBe('Sa');
    expect(texts.en.conditions.hour('14:00', '5°', null, '21 km/h', false)).toBe('14:00: 5°, rain or snow unknown, gusts 21 km/h');
    expect(texts.de.conditions.hour('14:00', '5°', '0.1 mm', '21 km/h', true)).toBe('14:00: 5°, 0.1 mm Niederschlag, Böen 21 km/h, Gewitter');
  });
});

describe('a message to the contacts', () => {
  const failure: SentMessage = {
    id: 1,
    message: 'alert',
    round: 2,
    contacts: [{ id: 'c1' as EmergencyContactId, name: 'Luca' }],
    channel: 'email',
    address: 'luca@example.com',
    outcome: 'failed',
    at: new Date(2026, 9, 17, 16, 31),
    reason: 'HTTP 403: Resend validation_error',
    undelivered: false,
  };

  it('names the message with the glossary term and its Alert round, in English and German', () => {
    expect(texts.en.adventure.failure(failure)).toBe('Luca: Alert 2 of 3 by email (could not be delivered)');
    expect(texts.de.adventure.failure(failure)).toBe('Luca: Alarm 2 von 3 per E-Mail (konnte nicht zugestellt werden)');
    expect(texts.en.adventure.failure({ ...failure, message: 'deadline_update', round: null, channel: 'sms', reason: 'retries_exhausted' })).toBe(
      'Luca: Deadline Update by text message (gave up after several attempts)',
    );
    expect(texts.de.adventure.failure({ ...failure, message: 'heads_up', round: null, channel: 'sms', reason: 'channel_not_enabled' })).toBe(
      'Luca: Startnachricht per SMS (SMS sind noch nicht eingerichtet)',
    );
  });

  it('tells in a notification which text message did not arrive and whom to reach, in English and German', () => {
    const undelivered = { ...failure, message: 'heads_up' as const, round: null, channel: 'sms' as const, address: '+41791234567', undelivered: true };
    expect(texts.en.adventure.deliveryFailureNotice(undelivered)).toEqual({
      title: 'Heads-up not delivered to Luca',
      body: 'Your text message to +41 79 123 45 67 did not arrive. Reach Luca another way.',
    });
    expect(texts.de.adventure.deliveryFailureNotice(undelivered)).toEqual({
      title: 'Startnachricht an Luca nicht zugestellt',
      body: 'Deine SMS an +41 79 123 45 67 kam nicht an. Erreiche Luca auf anderem Weg.',
    });
    const shared = { ...undelivered, message: 'alert' as const, round: 2,
      contacts: [{ id: 'c1' as EmergencyContactId, name: 'Ben' }, { id: 'c2' as EmergencyContactId, name: 'Luca' }] };
    expect(texts.en.adventure.deliveryFailureNotice(shared)).toEqual({
      title: 'Alert 2 of 3 not delivered to Ben, Luca',
      body: 'Your text message to +41 79 123 45 67 did not arrive. Reach them another way.',
    });
    expect(texts.de.adventure.deliveryFailureNotice(shared).title).toBe('Alarm 2 von 3 an Ben, Luca nicht zugestellt');
  });

  it('reads as one sentence to VoiceOver, naming every contact on a shared address', () => {
    const shared = { ...failure, message: 'heads_up' as const, round: null, outcome: 'delivered' as const, reason: null,
      contacts: [{ id: 'c1' as EmergencyContactId, name: 'Ben' }, { id: 'c2' as EmergencyContactId, name: 'Luca' }] };
    expect(texts.en.adventure.messageLabel(shared, '14:03')).toBe('Heads-up to Ben, Luca by email, luca@example.com. Delivered 14:03.');
    expect(texts.de.adventure.messageLabel(failure, '16:31')).toBe(
      'Alarm 2 von 3 an Luca per E-Mail, luca@example.com. Fehlgeschlagen 16:31: Konnte nicht zugestellt werden. Doppeltippen, um sie selbst zu erreichen.',
    );
  });
});

describe('liveActivityText', () => {
  const now = new Date(2026, 9, 17, 11, 58);

  it('gives the time alone for a Deadline today, in both languages', () => {
    expect(liveActivityText(new Date(2026, 9, 17, 12, 15), now, texts.en)).toEqual({ checkInBy: 'Check in by 12:15', checkIn: 'Check In' });
    expect(liveActivityText(new Date(2026, 9, 17, 12, 15), now, texts.de)).toEqual({ checkInBy: 'Zurückmelden bis 12:15', checkIn: 'Zurückmelden' });
  });

  it('names the day of a Deadline tomorrow', () => {
    expect(liveActivityText(new Date(2026, 9, 18, 9, 0), now, texts.en).checkInBy).toBe('Check in by Sun 18 Oct at 09:00');
    expect(liveActivityText(new Date(2026, 9, 18, 9, 0), now, texts.de).checkInBy).toBe('Zurückmelden bis So, 18. Okt. um 09:00');
  });
});
