import { describe, expect, it } from '@jest/globals';

import {
  CONDITIONS_REFRESH_MS,
  createConditions,
  daylightView,
  type ForecastHour,
  forecastView,
  MIN_FORECAST_HOURS,
  POINT_DECIMALS,
} from './conditions';
import type { Point } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const HOUR = 3_600_000;
const zermatt = { latitude: 46.0207, longitude: 7.7491 };
const saasFee = { latitude: 46.1084, longitude: 7.9277 };
const chamonix = { latitude: 45.9237, longitude: 6.8694 };
const dolomites = { latitude: 46.41, longitude: 11.84 };
const start = new Date('2026-02-01T09:20:00Z');

const openMeteo = (from: Date, hours: number) => {
  const first = Math.floor(from.getTime() / HOUR) * HOUR;
  const times = Array.from({ length: hours }, (_, i) => (first + i * HOUR) / 1000);
  return {
    hourly: {
      time: times,
      temperature_2m: times.map((_, i) => -5 + i),
      precipitation: times.map((_, i) => (i === 3 ? 1.2 : 0)),
      wind_gusts_10m: times.map(() => 40),
      weather_code: times.map((_, i) => (i === 3 ? 95 : 2)),
      freezing_level_height: times.map((_, i) => 1800 + i * 10),
    },
  };
};

// One bulletin whose region is a square around Zermatt and Saas-Fee, as SLF sends it.
const square = (p: Point, d: number) => [
  [
    [
      [p.longitude - d, p.latitude - d],
      [p.longitude + d, p.latitude - d],
      [p.longitude + d, p.latitude + d],
      [p.longitude - d, p.latitude + d],
      [p.longitude - d, p.latitude - d],
    ],
  ],
];
const slf = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        validTime: { startTime: '2026-02-01T07:00:00Z', endTime: '2026-02-01T16:00:00Z' },
        dangerRatings: [
          { mainValue: 'moderate', validTimePeriod: 'all_day', customData: { CH: { subdivision: 'plus' } } },
          { mainValue: 'considerable', validTimePeriod: 'all_day', customData: { CH: { subdivision: 'minus' } } },
        ],
        avalancheProblems: [{ problemType: 'wind_slab' }, { problemType: 'persistent_weak_layers' }, { problemType: 'wind_slab' }],
      },
      geometry: { type: 'MultiPolygon', coordinates: square(zermatt, 0.2) },
    },
  ],
};

const setup = ({ failing = false } = {}) => {
  const world = { now: start, failing };
  const asked: string[] = [];
  const conditions = createConditions({
    storage: memoryStorage(),
    now: () => world.now,
    language: () => 'en',
    fetchJson: async (url) => {
      asked.push(url);
      if (world.failing) throw new Error('no signal');
      return url.includes('open-meteo') ? openMeteo(world.now, 120) : slf;
    },
  });
  return { conditions, asked, world };
};

describe('Conditions', () => {
  it('sends Open-Meteo the point rounded to about a kilometre', async () => {
    const { conditions, asked } = setup();
    await conditions.at(zermatt);
    expect(POINT_DECIMALS).toBe(2);
    expect(asked[0]).toContain('latitude=46.02&longitude=7.75');
  });

  it('shows the highest danger level of the bulletin whose region contains the destination', async () => {
    const { conditions } = setup();
    const result = await conditions.at(zermatt);
    if (result.kind !== 'shown') throw new Error(result.kind);
    expect(result.conditions.bulletin).toEqual({
      level: 3,
      subdivision: 'minus',
      problems: ['wind_slab', 'persistent_weak_layers'],
      validUntil: new Date('2026-02-01T16:00:00Z'),
    });
  });

  it('loads the bulletin once for every place it covers', async () => {
    const { conditions, asked } = setup();
    await conditions.at(zermatt);
    await conditions.at(saasFee);
    expect(asked.filter((u) => u.includes('slf'))).toHaveLength(1);
  });

  it('leaves the bulletin out where no region of the SLF contains the destination', async () => {
    const { conditions } = setup();
    const result = await conditions.at(chamonix);
    if (result.kind !== 'shown') throw new Error(result.kind);
    expect(result.conditions.bulletin).toBeNull();
  });

  it('does not ask the SLF for a destination far from Switzerland', async () => {
    const { conditions, asked } = setup();
    const result = await conditions.at(dolomites);
    if (result.kind !== 'shown') throw new Error(result.kind);
    expect(result.conditions.bulletin).toBeNull();
    expect(asked.filter((u) => u.includes('slf'))).toEqual([]);
  });

  it('asks again only once the fetched Conditions are half an hour old', async () => {
    const { conditions, asked, world } = setup();
    await conditions.at(zermatt);
    expect(CONDITIONS_REFRESH_MS).toBe(30 * 60_000);
    world.now = new Date(start.getTime() + CONDITIONS_REFRESH_MS - 1);
    await conditions.at(zermatt);
    expect(asked).toHaveLength(2);
    world.now = new Date(start.getTime() + CONDITIONS_REFRESH_MS);
    await conditions.at(zermatt);
    expect(asked).toHaveLength(4);
  });

  it('asks again at once for another place', async () => {
    const { conditions, asked } = setup();
    await conditions.at(zermatt);
    await conditions.at({ latitude: 46.5, longitude: 7.75 });
    expect(asked.filter((u) => u.includes('open-meteo'))).toHaveLength(2);
  });

  it('shows the kept Conditions with their time when it cannot ask', async () => {
    const { conditions, world } = setup();
    await conditions.at(zermatt);
    world.now = new Date(start.getTime() + 2 * HOUR);
    world.failing = true;
    const result = await conditions.at(zermatt);
    expect(result.kind).toBe('stale');
    expect(result.kind === 'stale' && result.conditions.fetchedAt).toEqual(start);
  });

  it('says Conditions need signal when none are kept', async () => {
    const { conditions } = setup({ failing: true });
    expect(await conditions.at(zermatt)).toEqual({ kind: 'unavailable' });
  });
});

describe('daylightView', () => {
  it('counts the daylight left until Dark today', () => {
    const view = daylightView(zermatt, new Date(start.getTime() + 8 * HOUR), start);
    expect(view.otherDay).toBeNull();
    expect(view.left).toBe(view.dark!.getTime() - start.getTime());
  });

  it('shows the Deadline’s day when it is not today, without the daylight left', () => {
    const deadline = new Date('2026-02-03T15:00:00Z');
    const view = daylightView(zermatt, deadline, start);
    expect(view.otherDay).toEqual(deadline);
    expect(view.dark!.toDateString()).toBe(deadline.toDateString());
    expect(view.left).toBeNull();
  });
});

describe('forecastView', () => {
  const hours: ForecastHour[] = Array.from({ length: 48 }, (_, i) => ({
    at: new Date(Date.parse('2026-02-01T09:00:00Z') + i * HOUR),
    temperatureC: 0,
    precipitationMm: 0,
    gustsKmh: 0,
    weatherCode: i === 2 ? 95 : 0,
    freezingLevelM: 2000 + i * 10,
  }));

  it('covers the hours from now until the Deadline, with the thunderstorm and the dark hours marked', () => {
    const view = forecastView(hours, zermatt, new Date('2026-02-01T19:00:00Z'), start);
    expect(view.hours[0]!.at).toEqual(new Date('2026-02-01T09:00:00Z'));
    expect(view.hours.at(-1)!.at).toEqual(new Date('2026-02-01T19:00:00Z'));
    expect(view.hours.map((h) => h.thunderstorm).indexOf(true)).toBe(2);
    expect(view.hours[0]!.dark).toBe(false);
    expect(view.hours.at(-1)!.dark).toBe(true);
    expect(view.freezingLevelM).toEqual({ low: 2000, high: 2100 });
    expect(view.reachesFrom).toBeNull();
  });

  it('is dry only when every shown hour forecasts no rain or snow, not when one has some or has no value', () => {
    const deadline = new Date('2026-02-01T19:00:00Z');
    expect(forecastView(hours, zermatt, deadline, start).dry).toBe(true);
    const wet = hours.map((h, i) => (i === 4 ? { ...h, precipitationMm: 0.4 } : h));
    expect(forecastView(wet, zermatt, deadline, start).dry).toBe(false);
    const gap = hours.map((h, i) => (i === 4 ? { ...h, precipitationMm: null } : h));
    expect(forecastView(gap, zermatt, deadline, start).dry).toBe(false);
    expect(forecastView([], zermatt, deadline, start).dry).toBe(false);
  });

  it('shows at least a few hours when the Deadline is sooner', () => {
    expect(MIN_FORECAST_HOURS).toBe(6);
    expect(forecastView(hours, zermatt, new Date('2026-02-01T10:00:00Z'), start).hours).toHaveLength(MIN_FORECAST_HOURS);
  });

  it('says from when the forecast reaches a Deadline beyond it', () => {
    const view = forecastView(hours, zermatt, new Date('2026-02-05T12:00:00Z'), start);
    expect(view.hours).toHaveLength(48);
    expect(view.reachesFrom).toEqual(new Date('2026-02-03T13:00:00Z'));
  });
});
