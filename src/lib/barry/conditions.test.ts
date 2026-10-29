import { describe, expect, it } from '@jest/globals';

import {
  CONDITIONS_REFRESH_MS,
  createConditions,
  forecastWindow,
  type ForecastHour,
  MIN_FORECAST_HOURS,
  POINT_DECIMALS,
} from './conditions';
import type { AdventureId, PlannedAdventure, Point } from './types';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

const HOUR = 3_600_000;
const zermatt = { latitude: 46.0207, longitude: 7.7491 };
const chamonix = { latitude: 45.9237, longitude: 6.8694 };
const dolomites = { latitude: 46.41, longitude: 11.84 };
const start = new Date('2026-02-01T09:20:00Z');

const planned = (point: Point | null, deadline = new Date(start.getTime() + 8 * HOUR)) =>
  ({
    id: 'a1' as AdventureId,
    stage: 'planned',
    contacts: [],
    plan: { destination: 'Hörnlihütte', destinationPoint: point },
    deadline,
  }) as PlannedAdventure;

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

// One bulletin whose region is a square around Zermatt, as SLF sends it.
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
      geometry: { type: 'MultiPolygon', coordinates: square(zermatt, 0.1) },
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
  it('asks nobody without a destination on the map', async () => {
    const { conditions, asked } = setup();
    expect(await conditions.forAdventure(planned(null))).toEqual({ kind: 'no_point' });
    expect(asked).toEqual([]);
  });

  it('sends Open-Meteo the point rounded to about a kilometre', async () => {
    const { conditions, asked } = setup();
    await conditions.forAdventure(planned(zermatt));
    expect(POINT_DECIMALS).toBe(2);
    expect(asked[0]).toContain('latitude=46.02&longitude=7.75');
  });

  it('shows the hourly forecast with the thunderstorm hour marked', async () => {
    const { conditions } = setup();
    const view = await conditions.forAdventure(planned(zermatt));
    if (view.kind !== 'shown') throw new Error(view.kind);
    const storm = view.conditions.forecast[3]!;
    expect(storm).toMatchObject({ thunderstorm: true, precipitationMm: 1.2, gustsKmh: 40 });
    expect(view.conditions.forecast[0]!.thunderstorm).toBe(false);
  });

  it('shows the highest danger level of the bulletin whose region contains the destination', async () => {
    const { conditions } = setup();
    const view = await conditions.forAdventure(planned(zermatt));
    if (view.kind !== 'shown') throw new Error(view.kind);
    expect(view.conditions.bulletin).toEqual({
      level: 3,
      subdivision: 'minus',
      problems: ['wind_slab', 'persistent_weak_layers'],
      validUntil: new Date('2026-02-01T16:00:00Z'),
    });
  });

  it('leaves the bulletin out where no region of the SLF contains the destination', async () => {
    const { conditions } = setup();
    const view = await conditions.forAdventure(planned(chamonix));
    if (view.kind !== 'shown') throw new Error(view.kind);
    expect(view.conditions.bulletin).toBeNull();
  });

  it('does not ask the SLF for a destination far from Switzerland', async () => {
    const { conditions, asked } = setup();
    const view = await conditions.forAdventure(planned(dolomites));
    if (view.kind !== 'shown') throw new Error(view.kind);
    expect(view.conditions.bulletin).toBeNull();
    expect(asked.filter((u) => u.includes('slf'))).toEqual([]);
  });

  it('asks again only once the fetched Conditions are half an hour old', async () => {
    const { conditions, asked, world } = setup();
    await conditions.forAdventure(planned(zermatt));
    expect(CONDITIONS_REFRESH_MS).toBe(30 * 60_000);
    world.now = new Date(start.getTime() + CONDITIONS_REFRESH_MS - 1);
    await conditions.forAdventure(planned(zermatt));
    expect(asked).toHaveLength(2);
    world.now = new Date(start.getTime() + CONDITIONS_REFRESH_MS);
    await conditions.forAdventure(planned(zermatt));
    expect(asked).toHaveLength(4);
  });

  it('asks again at once when the destination moved', async () => {
    const { conditions, asked } = setup();
    await conditions.forAdventure(planned(zermatt));
    await conditions.forAdventure(planned({ latitude: 46.5, longitude: 7.75 }));
    expect(asked).toHaveLength(4);
  });

  it('shows the kept Conditions with their time when it cannot ask', async () => {
    const { conditions, world } = setup();
    await conditions.forAdventure(planned(zermatt));
    world.now = new Date(start.getTime() + 2 * HOUR);
    world.failing = true;
    const view = await conditions.forAdventure(planned(zermatt));
    expect(view.kind).toBe('stale');
    expect(view.kind === 'stale' && view.conditions.fetchedAt).toEqual(start);
  });

  it('says Conditions need signal when none are kept', async () => {
    const { conditions } = setup({ failing: true });
    const view = await conditions.forAdventure(planned(zermatt));
    expect(view.kind).toBe('unavailable');
  });

  it('always has sunset and Dark, which the phone computes itself', async () => {
    const { conditions } = setup({ failing: true });
    const view = await conditions.forAdventure(planned(zermatt));
    if (view.kind === 'no_point') throw new Error(view.kind);
    expect(view.daylight.dark).not.toBeNull();
    expect(view.daylight.left).toBeGreaterThan(0);
  });
});

describe('forecastWindow', () => {
  const hours: ForecastHour[] = Array.from({ length: 48 }, (_, i) => ({
    at: new Date(Date.parse('2026-02-01T09:00:00Z') + i * HOUR),
    temperatureC: 0,
    precipitationMm: 0,
    gustsKmh: 0,
    weatherCode: 0,
    thunderstorm: false,
    freezingLevelM: 2000,
  }));

  it('covers the hours from now until the Deadline', () => {
    const window = forecastWindow(hours, start, new Date('2026-02-01T19:00:00Z'));
    expect(window.hours[0]!.at).toEqual(new Date('2026-02-01T09:00:00Z'));
    expect(window.hours.at(-1)!.at).toEqual(new Date('2026-02-01T19:00:00Z'));
    expect(window.reachesFrom).toBeNull();
  });

  it('shows at least a few hours when the Deadline is sooner', () => {
    expect(MIN_FORECAST_HOURS).toBe(6);
    expect(forecastWindow(hours, start, new Date('2026-02-01T10:00:00Z')).hours).toHaveLength(MIN_FORECAST_HOURS);
  });

  it('says from when the forecast reaches a Deadline beyond it', () => {
    const window = forecastWindow(hours, start, new Date('2026-02-05T12:00:00Z'));
    expect(window.hours).toHaveLength(48);
    expect(window.reachesFrom).toEqual(new Date('2026-02-03T13:00:00Z'));
  });
});
