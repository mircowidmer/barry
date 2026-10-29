import { describe, expect, it } from '@jest/globals';

import {
  adventureDay,
  CONDITIONS_REFRESH_MS,
  createConditions,
  daylightView,
  type ForecastHour,
  forecastView,
  KEPT,
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

const setup = ({ failing = false, bulletin = slf as unknown, forecast = null as unknown, stored = null as string | null } = {}) => {
  const world = { now: start, failing };
  const asked: string[] = [];
  const storage = memoryStorage();
  if (stored !== null) storage.setItem('barry.conditions', stored);
  const conditions = createConditions({
    storage,
    now: () => world.now,
    language: () => 'en',
    fetchJson: async (url) => {
      asked.push(url);
      if (world.failing) throw new Error('no signal');
      return url.includes('open-meteo') ? (forecast ?? openMeteo(world.now, 120)) : bulletin;
    },
  });
  return { conditions, asked, world };
};

const period = (startTime: string, endTime: string, mainValue: string) => ({
  type: 'Feature',
  properties: { validTime: { startTime, endTime }, dangerRatings: [{ mainValue, validTimePeriod: 'all_day' }] },
  geometry: { type: 'MultiPolygon', coordinates: square(zermatt, 0.2) },
});

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

  it('shows the validity period that covers now when the region has several, else the latest', async () => {
    const morning = period('2026-02-01T07:00:00Z', '2026-02-01T09:00:00Z', 'low');
    const evening = period('2026-02-01T09:00:00Z', '2026-02-01T16:00:00Z', 'high');
    const { conditions } = setup({ bulletin: { features: [morning, evening] } });
    const result = await conditions.at(zermatt);
    if (result.kind !== 'shown') throw new Error(result.kind);
    expect(result.conditions.bulletin?.level).toBe(4);
    const later = setup({ bulletin: { features: [morning, evening] } });
    later.world.now = new Date('2026-02-01T18:00:00Z');
    const result2 = await later.conditions.at(zermatt);
    if (result2.kind !== 'shown') throw new Error(result2.kind);
    expect(result2.conditions.bulletin?.validUntil).toEqual(new Date('2026-02-01T16:00:00Z'));
  });

  it('keeps the forecast when the bulletin is malformed', async () => {
    const { conditions } = setup({ bulletin: { features: [{ type: 'Feature', properties: {}, geometry: slf.features[0]!.geometry }] } });
    const result = await conditions.at(zermatt);
    if (result.kind !== 'shown') throw new Error(result.kind);
    expect(result.conditions.forecast).toHaveLength(120);
    expect(result.conditions.bulletin).toBeNull();
  });

  it('leaves out the hours Open-Meteo has no forecast for', async () => {
    const forecast = openMeteo(start, 4) as unknown as { hourly: Record<string, (number | null)[]> };
    forecast.hourly.temperature_2m![3] = null;
    forecast.hourly.weather_code![1] = null;
    const { conditions } = setup({ forecast });
    const result = await conditions.at(zermatt);
    if (result.kind !== 'shown') throw new Error(result.kind);
    expect(result.conditions.forecast.map((h) => h.at.getUTCHours())).toEqual([9, 11]);
  });

  it('keeps the Conditions of the newest places only', async () => {
    const { conditions, world } = setup();
    const places = Array.from({ length: KEPT + 1 }, (_, i) => ({ latitude: 46.5 + i * 0.1, longitude: 7.75 }));
    for (const place of places) await conditions.at(place);
    world.failing = true;
    expect(KEPT).toBe(5);
    expect((await conditions.at(places[0]!)).kind).toBe('unavailable');
    expect((await conditions.at(places[1]!)).kind).toBe('shown');
  });

  it('starts afresh when what storage holds is not a list', async () => {
    const { conditions } = setup({ stored: '{"point":{}}' });
    expect((await conditions.at(zermatt)).kind).toBe('shown');
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

// The view tests read the clock in the phone's zone, as the screen does: February 2026 at Zermatt, where dawn is after 07:00 and Dark before 18:30.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 1, day, hour, minute);
const now = new Date(2026, 1, 1, 10, 20);

describe('adventureDay', () => {
  it('is the Deadline’s day, or the day before when the Deadline falls in the dark before dawn', () => {
    expect(adventureDay(zermatt, at(2, 15))).toEqual(at(2, 0));
    expect(adventureDay(zermatt, at(2, 22))).toEqual(at(2, 0));
    expect(adventureDay(zermatt, at(2, 1))).toEqual(at(1, 0));
    expect(adventureDay(zermatt, at(2, 6))).toEqual(at(1, 0));
  });
});

describe('daylightView', () => {
  it('counts the daylight left until Dark today', () => {
    const view = daylightView(zermatt, at(1, 18), now);
    expect(view.otherDay).toBeNull();
    expect(view.left).toBe(view.dark!.getTime() - now.getTime());
  });

  it('shows the Adventure Day when it is not today, without the daylight left', () => {
    const view = daylightView(zermatt, at(3, 15), now);
    expect(view.otherDay).toEqual(at(3, 0));
    expect(view.dark!.toDateString()).toBe(at(3, 0).toDateString());
    expect(view.left).toBeNull();
  });

  it('stays on today for a Deadline before tomorrow’s dawn', () => {
    const view = daylightView(zermatt, at(2, 1), now);
    expect(view.otherDay).toBeNull();
    expect(view.dark!.toDateString()).toBe(now.toDateString());
  });
});

describe('forecastView', () => {
  const hours: ForecastHour[] = Array.from({ length: 7 * 24 }, (_, i) => ({
    at: new Date(at(1, 0).getTime() + i * HOUR),
    temperatureC: 0,
    precipitationMm: 0,
    gustsKmh: 0,
    weatherCode: i === 12 ? 95 : 0,
    freezingLevelM: 2000 + i * 10,
  }));

  it('covers the hours of today still to come, with the thunderstorm and the dark hours marked', () => {
    const view = forecastView(hours, zermatt, at(1, 19), now);
    expect(view.day).toEqual(at(1, 0));
    expect(view.hours[0]!.at).toEqual(at(1, 10));
    expect(view.hours.at(-1)!.at).toEqual(at(1, 23));
    expect(view.hours.map((h) => h.thunderstorm).indexOf(true)).toBe(2);
    expect(view.hours[0]!.dark).toBe(false);
    expect(view.hours.at(-1)!.dark).toBe(true);
    expect(view.hours.some((h) => h.newDay)).toBe(false);
    expect(view.freezingLevelM).toEqual({ low: 2100, high: 2230 });
    expect(view.reachesFrom).toBeNull();
  });

  it('covers the whole Adventure Day when it is another day', () => {
    const view = forecastView(hours, zermatt, at(3, 15), now);
    expect(view.day).toEqual(at(3, 0));
    expect(view.hours).toHaveLength(24);
    expect(view.hours[0]!.at).toEqual(at(3, 0));
    expect(view.hours.at(-1)!.at).toEqual(at(3, 23));
    expect(view.hours.some((h) => h.newDay)).toBe(false);
  });

  it('runs through to a Deadline before the next dawn and marks the first hour of the new day', () => {
    const view = forecastView(hours, zermatt, at(2, 1), now);
    expect(view.day).toEqual(at(1, 0));
    expect(view.hours[0]!.at).toEqual(at(1, 10));
    expect(view.hours.at(-1)!.at).toEqual(at(2, 1));
    expect(view.hours.filter((h) => h.newDay).map((h) => h.at)).toEqual([at(2, 0)]);
  });

  it('is dry only when every shown hour forecasts no rain or snow, not when one has some or has no value', () => {
    const deadline = at(1, 19);
    expect(forecastView(hours, zermatt, deadline, now).dry).toBe(true);
    const wet = hours.map((h, i) => (i === 14 ? { ...h, precipitationMm: 0.4 } : h));
    expect(forecastView(wet, zermatt, deadline, now).dry).toBe(false);
    const gap = hours.map((h, i) => (i === 14 ? { ...h, precipitationMm: null } : h));
    expect(forecastView(gap, zermatt, deadline, now).dry).toBe(false);
    expect(forecastView([], zermatt, deadline, now).dry).toBe(false);
  });

  it('shows at least a few hours late in the day, past midnight', () => {
    expect(MIN_FORECAST_HOURS).toBe(6);
    const view = forecastView(hours, zermatt, at(1, 22), at(1, 21, 20));
    expect(view.hours).toHaveLength(MIN_FORECAST_HOURS);
    expect(view.hours.at(-1)!.at).toEqual(at(2, 2));
    expect(view.hours.filter((h) => h.newDay).map((h) => h.at)).toEqual([at(2, 0)]);
  });

  it('says from when the forecast reaches an Adventure Day beyond it', () => {
    const view = forecastView(hours, zermatt, at(9, 15), now);
    expect(view.hours).toHaveLength(0);
    expect(view.reachesFrom).toEqual(at(3, 10));
  });
});
