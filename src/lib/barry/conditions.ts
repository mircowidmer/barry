import type { AppLanguage } from '@/lib/language';

import { daylightOn, isDark } from './daylight';
import { darkBefore } from './warnings';
import type { Adventure, AdventureId, Point } from './types';

/** How long fetched Conditions count as current before the phone asks again. */
export const CONDITIONS_REFRESH_MS = 30 * 60_000;
/** Two decimals are about a kilometre, the forecast's own grid; more would only tell Open-Meteo where exactly. */
export const POINT_DECIMALS = 2;
/** The forecast shows at least these hours, even when the Deadline is sooner. */
export const MIN_FORECAST_HOURS = 6;
// The Adventures whose Conditions the phone keeps; older ones make room.
const KEPT = 5;

const KEY = 'barry.conditions';
const HOUR_MS = 3_600_000;
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
// Switzerland and Liechtenstein with a margin; the SLF covers no place outside.
const SLF_AREA = { south: 45.7, north: 47.9, west: 5.8, east: 10.6 };
const DANGER_LEVELS = ['low', 'moderate', 'considerable', 'high', 'very_high'];

export type ForecastHour = {
  at: Date;
  temperatureC: number;
  precipitationMm: number;
  gustsKmh: number;
  /** The WMO weather code, which picks the symbol. */
  weatherCode: number;
  thunderstorm: boolean;
  freezingLevelM: number | null;
};

export type AvalancheBulletin = {
  /** The European danger level, 1 to 5. */
  level: number;
  /** The SLF's finer step within the level. */
  subdivision: 'minus' | 'neutral' | 'plus' | null;
  /** CAAML problem types, such as wind_slab, most important first. */
  problems: string[];
  validUntil: Date;
};

export type FetchedConditions = { fetchedAt: Date; forecast: ForecastHour[]; bulletin: AvalancheBulletin | null };

export type DaylightView = {
  sunset: Date | null;
  dark: Date | null;
  /** How long until Dark today, or null when Dark has fallen, is on another day or does not come. */
  left: number | null;
  /** The Dark the Deadline falls after, or null. */
  afterDark: Date | null;
};

export type ConditionsView =
  | { kind: 'no_point' }
  | { kind: 'shown'; conditions: FetchedConditions; daylight: DaylightView }
  | { kind: 'stale'; conditions: FetchedConditions; daylight: DaylightView }
  | { kind: 'unavailable'; daylight: DaylightView };

export type ConditionsDeps = {
  /** The parsed JSON at the URL; throws without signal or on an error status. */
  fetchJson(url: string): Promise<unknown>;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  now(): Date;
  language(): AppLanguage;
};

const round = (point: Point): Point => ({
  latitude: Number(point.latitude.toFixed(POINT_DECIMALS)),
  longitude: Number(point.longitude.toFixed(POINT_DECIMALS)),
});

const openMeteoUrl = ({ latitude, longitude }: Point) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
  '&hourly=temperature_2m,precipitation,wind_gusts_10m,weather_code,freezing_level_height&timeformat=unixtime&forecast_days=7';

const slfUrl = (language: AppLanguage) => `https://aws.slf.ch/api/bulletin/caaml/${language}/geojson`;

type OpenMeteo = {
  hourly: {
    time: number[];
    temperature_2m: number[];
    precipitation: number[];
    wind_gusts_10m: number[];
    weather_code: number[];
    freezing_level_height?: (number | null)[];
  };
};

const parseForecast = (json: unknown): ForecastHour[] => {
  const { hourly } = json as OpenMeteo;
  return hourly.time.map((time, i) => ({
    at: new Date(time * 1000),
    temperatureC: hourly.temperature_2m[i] ?? 0,
    precipitationMm: hourly.precipitation[i] ?? 0,
    gustsKmh: hourly.wind_gusts_10m[i] ?? 0,
    weatherCode: hourly.weather_code[i] ?? 0,
    thunderstorm: THUNDERSTORM_CODES.has(hourly.weather_code[i] ?? 0),
    freezingLevelM: hourly.freezing_level_height?.[i] ?? null,
  }));
};

type Ring = [number, number][];
type Feature = {
  properties: {
    validTime: { endTime: string };
    dangerRatings?: { mainValue: string; customData?: { CH?: { subdivision?: string } } }[];
    avalancheProblems?: { problemType: string }[];
  };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } | null;
};

// Even-odd ray casting over every ring, so holes count as outside.
const inside = ({ latitude: y, longitude: x }: Point, rings: Ring[]) => {
  let crossings = 0;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings++;
    }
  }
  return crossings % 2 === 1;
};

const rings = (geometry: Feature['geometry']): Ring[] =>
  !geometry ? [] : geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();

const parseBulletin = (json: unknown, point: Point): AvalancheBulletin | null => {
  const features = (json as { features?: Feature[] }).features ?? [];
  const feature = features.find((f) => inside(point, rings(f.geometry)));
  if (!feature) return null;
  const rated = (feature.properties.dangerRatings ?? [])
    .map((r) => ({ level: DANGER_LEVELS.indexOf(r.mainValue) + 1, subdivision: r.customData?.CH?.subdivision }))
    .filter((r) => r.level > 0);
  if (rated.length === 0) return null;
  const highest = rated.reduce((a, b) => (b.level > a.level ? b : a));
  const subdivision = highest.subdivision === 'minus' || highest.subdivision === 'neutral' || highest.subdivision === 'plus' ? highest.subdivision : null;
  return {
    level: highest.level,
    subdivision,
    problems: [...new Set((feature.properties.avalancheProblems ?? []).map((p) => p.problemType))],
    validUntil: new Date(feature.properties.validTime.endTime),
  };
};

const inSlfArea = ({ latitude, longitude }: Point) =>
  latitude >= SLF_AREA.south && latitude <= SLF_AREA.north && longitude >= SLF_AREA.west && longitude <= SLF_AREA.east;

/** The hours from now until the Deadline, at least MIN_FORECAST_HOURS, and from when the forecast reaches a Deadline beyond it. */
export const forecastWindow = (hours: ForecastHour[], now: Date, deadline: Date | null) => {
  const from = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const upcoming = hours.filter((h) => h.at.getTime() >= from);
  const until = Math.max(deadline?.getTime() ?? 0, from + (MIN_FORECAST_HOURS - 1) * HOUR_MS);
  const last = upcoming.at(-1);
  const reachesFrom = deadline && last && deadline.getTime() > last.at.getTime() ? new Date(deadline.getTime() - (last.at.getTime() - from)) : null;
  return { hours: upcoming.filter((h) => h.at.getTime() <= until), reachesFrom };
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const daylightView = (point: Point, deadline: Date | null, now: Date): DaylightView => {
  const day = deadline && !sameDay(deadline, now) && deadline > now ? deadline : now;
  const { sunset, dark } = daylightOn(point, day);
  const left = day === now && dark && dark > now && !isDark(point, now) ? dark.getTime() - now.getTime() : null;
  return { sunset, dark, left, afterDark: darkBefore(deadline, point) };
};

type Kept = { id: AdventureId; point: Point; fetchedAt: string; forecast: (Omit<ForecastHour, 'at'> & { at: string })[]; bulletin: (Omit<AvalancheBulletin, 'validUntil'> & { validUntil: string }) | null };

const revive = (kept: Kept): FetchedConditions => ({
  fetchedAt: new Date(kept.fetchedAt),
  forecast: kept.forecast.map((h) => ({ ...h, at: new Date(h.at) })),
  bulletin: kept.bulletin && { ...kept.bulletin, validUntil: new Date(kept.bulletin.validUntil) },
});

export const createConditions = ({ fetchJson, storage, now, language }: ConditionsDeps) => {
  const load = (): Kept[] => {
    try {
      return JSON.parse(storage.getItem(KEY) || '[]') as Kept[];
    } catch {
      return [];
    }
  };

  const keep = (id: AdventureId, point: Point, conditions: FetchedConditions) => {
    const others = load().filter((k) => k.id !== id);
    storage.setItem(KEY, JSON.stringify([{ id, point, ...conditions }, ...others].slice(0, KEPT)));
  };

  const fetchConditions = async (point: Point): Promise<FetchedConditions> => {
    const [forecast, bulletin] = await Promise.all([
      fetchJson(openMeteoUrl(point)).then(parseForecast),
      inSlfArea(point) ? fetchJson(slfUrl(language())).then((json) => parseBulletin(json, point), () => null) : null,
    ]);
    return { fetchedAt: now(), forecast, bulletin };
  };

  return {
    /** The Conditions at the Adventure's destination on the map, fetched at most every CONDITIONS_REFRESH_MS. */
    forAdventure: async (adventure: Adventure): Promise<ConditionsView> => {
      const exact = adventure.plan.destinationPoint;
      if (!exact) return { kind: 'no_point' };
      const point = round(exact);
      const daylight = daylightView(exact, adventure.deadline, now());
      const found = load().find((k) => k.id === adventure.id && k.point.latitude === point.latitude && k.point.longitude === point.longitude);
      const kept = found && revive(found);
      if (kept && now().getTime() - kept.fetchedAt.getTime() < CONDITIONS_REFRESH_MS) return { kind: 'shown', conditions: kept, daylight };
      try {
        const conditions = await fetchConditions(point);
        keep(adventure.id, point, conditions);
        return { kind: 'shown', conditions, daylight };
      } catch {
        return kept ? { kind: 'stale', conditions: kept, daylight } : { kind: 'unavailable', daylight };
      }
    },
  };
};
