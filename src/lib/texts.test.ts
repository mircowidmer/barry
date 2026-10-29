import { describe, expect, it } from '@jest/globals';

import type { DeliveryFailure } from '@/lib/barry';

import { texts } from './texts';

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

describe('a Delivery Failure', () => {
  const failure: DeliveryFailure = {
    id: 1,
    message: 'alert',
    contactName: 'Luca',
    channel: 'email',
    address: 'luca@example.com',
    reason: 'HTTP 403: Resend validation_error',
  };

  it('names the message with the glossary term, in English and German', () => {
    expect(texts.en.adventure.failure(failure)).toBe('Luca: Alert by email (HTTP 403: Resend validation_error)');
    expect(texts.de.adventure.failure(failure)).toBe('Luca: Alarm per E-Mail (HTTP 403: Resend validation_error)');
    expect(texts.en.adventure.failure({ ...failure, message: 'deadline_update', channel: 'sms', reason: 'retries_exhausted' })).toBe(
      'Luca: Deadline Update by text message (gave up after several attempts)',
    );
  });
});
