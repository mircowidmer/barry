import { describe, expect, it } from '@jest/globals';

import { DARK_ALTITUDE, daylightOn, isDark, lastDarkBefore } from './daylight';

const zermatt = { latitude: 46.02, longitude: 7.75 };
const tromso = { latitude: 69.65, longitude: 18.96 };

// The reference times come from suncalc 1.9.0, a separate implementation.
const near = (actual: Date | null, expected: string) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual!.getTime() - new Date(expected).getTime())).toBeLessThan(2 * 60_000);
};

describe('daylightOn', () => {
  it('puts sunset and Dark of a summer day in Zermatt where the sky has them', () => {
    const day = daylightOn(zermatt, new Date('2026-06-21T10:00:00Z'));
    near(day.sunset, '2026-06-21T19:24:40Z');
    near(day.dark, '2026-06-21T20:03:19Z');
  });

  it('puts sunset and Dark of a winter day in Zermatt where the sky has them', () => {
    const day = daylightOn(zermatt, new Date('2026-12-21T22:00:00Z'));
    near(day.sunset, '2026-12-21T15:47:17Z');
    near(day.dark, '2026-12-21T16:21:58Z');
  });

  it('has no sunset and no Dark where the sun does not set', () => {
    expect(daylightOn(tromso, new Date('2026-06-21T12:00:00Z'))).toEqual({ sunset: null, dark: null });
  });
});

describe('isDark', () => {
  it('is Dark only once civil twilight has ended', () => {
    expect(DARK_ALTITUDE).toBe(-6);
    expect(isDark(zermatt, new Date('2026-06-21T19:50:00Z'))).toBe(false);
    expect(isDark(zermatt, new Date('2026-06-21T20:10:00Z'))).toBe(true);
  });

  it('is Dark before the sky gets light again', () => {
    expect(isDark(zermatt, new Date('2026-06-21T02:50:00Z'))).toBe(true);
    expect(isDark(zermatt, new Date('2026-06-21T03:10:00Z'))).toBe(false);
  });

  it('is never Dark in the midnight sun', () => {
    expect(isDark(tromso, new Date('2026-06-21T23:00:00Z'))).toBe(false);
  });
});

describe('lastDarkBefore', () => {
  it('names the evening’s Dark for a Deadline late at night', () => {
    near(lastDarkBefore(zermatt, new Date('2026-12-21T20:00:00Z')), '2026-12-21T16:21:58Z');
  });

  it('names the evening before for a Deadline before dawn', () => {
    near(lastDarkBefore(zermatt, new Date('2026-12-22T05:00:00Z')), '2026-12-21T16:21:58Z');
  });
});
