import type { AppLanguage } from '@/lib/language';

import { darkBefore, daylightOnDay, isDark } from './daylight';
import type { Point } from './types';

/** How long fetched Conditions count as current before the phone asks again. */
export const CONDITIONS_REFRESH_MS = 30 * 60_000;
/** Two decimals are about a kilometre, the forecast's own grid; more would only tell Open-Meteo where exactly. */
export const POINT_DECIMALS = 2;
/** The forecast shows at least these hours, even when fewer are left of the Adventure Day. */
export const MIN_FORECAST_HOURS = 6;
/** The places whose Conditions the phone keeps; older ones make room. */
export const KEPT = 5;

const KEY = 'barry.conditions';
export const HOUR_MS = 3_600_000;
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
// Switzerland and Liechtenstein with a margin; the SLF covers no place outside.
const SLF_AREA = { south: 45.7, north: 47.9, west: 5.8, east: 10.6 };
const DANGER_LEVELS = ['low', 'moderate', 'considerable', 'high', 'very_high'];
const SUBDIVISIONS = ['minus', 'neutral', 'plus'] as const;

export type ForecastHour = {
  at: Date;
  temperatureC: number;
  /** Null when the forecast has no value for the hour. */
  precipitationMm: number | null;
  gustsKmh: number;
  /** The WMO weather code, which picks the symbol. */
  weatherCode: number;
  freezingLevelM: number | null;
};

export type AvalancheBulletin = {
  /** The European danger level, 1 to 5. */
  level: number;
  /** The SLF's finer step within the level. */
  subdivision: (typeof SUBDIVISIONS)[number] | null;
  /** CAAML problem types, such as wind_slab, most important first. */
  problems: string[];
  validUntil: Date;
};

type FetchedConditions = { fetchedAt: Date; forecast: ForecastHour[]; bulletin: AvalancheBulletin | null };

export type ConditionsResult =
  | { kind: 'shown' | 'stale'; conditions: FetchedConditions }
  | { kind: 'unavailable' };

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

const samePlace = (a: Point, b: Point) => a.latitude === b.latitude && a.longitude === b.longitude;

const openMeteoUrl = ({ latitude, longitude }: Point) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
  '&hourly=temperature_2m,precipitation,wind_gusts_10m,weather_code,freezing_level_height&timeformat=unixtime&forecast_days=7';

const slfUrl = (language: AppLanguage) => `https://aws.slf.ch/api/bulletin/caaml/${language}/geojson`;

type OpenMeteo = {
  hourly: {
    time: number[];
    temperature_2m: (number | null)[];
    precipitation: (number | null)[];
    wind_gusts_10m: (number | null)[];
    weather_code: (number | null)[];
    freezing_level_height?: (number | null)[];
  };
};

// An hour without a temperature, a weather code or gusts has no forecast, so it is left out rather than shown as 0° and clear.
const parseForecast = (json: unknown): ForecastHour[] => {
  const { hourly } = json as OpenMeteo;
  return hourly.time.flatMap((time, i) => {
    const temperatureC = hourly.temperature_2m[i];
    const gustsKmh = hourly.wind_gusts_10m[i];
    const weatherCode = hourly.weather_code[i];
    if (temperatureC == null || gustsKmh == null || weatherCode == null) return [];
    return [
      {
        at: new Date(time * 1000),
        temperatureC,
        precipitationMm: hourly.precipitation[i] ?? null,
        gustsKmh,
        weatherCode,
        freezingLevelM: hourly.freezing_level_height?.[i] ?? null,
      },
    ];
  });
};

type Ring = [number, number][];
type Feature = {
  properties: {
    validTime: { startTime: string; endTime: string };
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

const bulletinAt = (features: Feature[], point: Point, now: Date): AvalancheBulletin | null => {
  const covering = features.filter((f) => inside(point, rings(f.geometry)));
  const ends = (f: Feature) => Date.parse(f.properties.validTime.endTime);
  // The feed carries one feature per validity period of a region: the period that covers now, else the latest one.
  const feature =
    covering.find((f) => Date.parse(f.properties.validTime.startTime) <= now.getTime() && now.getTime() < ends(f)) ??
    covering.sort((a, b) => ends(b) - ends(a))[0];
  if (!feature) return null;
  const rated = (feature.properties.dangerRatings ?? [])
    .map((r) => ({ level: DANGER_LEVELS.indexOf(r.mainValue) + 1, subdivision: r.customData?.CH?.subdivision }))
    .filter((r) => r.level > 0);
  if (rated.length === 0) return null;
  const highest = rated.reduce((a, b) => (b.level > a.level ? b : a));
  const subdivision = SUBDIVISIONS.find((s) => s === highest.subdivision) ?? null;
  return {
    level: highest.level,
    subdivision,
    problems: [...new Set((feature.properties.avalancheProblems ?? []).map((p) => p.problemType))],
    validUntil: new Date(feature.properties.validTime.endTime),
  };
};

const inSlfArea = ({ latitude, longitude }: Point) =>
  latitude >= SLF_AREA.south && latitude <= SLF_AREA.north && longitude >= SLF_AREA.west && longitude <= SLF_AREA.east;

const midnightOf = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate());
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** The Adventure Day, as midnight in the phone's time zone: the Deadline's day, or the day before when the Deadline falls in the dark before dawn. */
export const adventureDay = (point: Point, deadline: Date): Date => {
  const dark = darkBefore(deadline, point);
  return midnightOf(dark && !sameDay(dark, deadline) ? dark : deadline);
};

export type DaylightView = {
  /** The Adventure Day when it is not today; sunset and Dark are then that day's. */
  otherDay: Date | null;
  sunset: Date | null;
  dark: Date | null;
  /** How long until Dark today, or null when Dark has fallen, is on another day or does not come. */
  left: number | null;
};

/** Sunset and Dark at the point on the Adventure Day, or today's with the daylight left. */
export const daylightView = (point: Point, deadline: Date | null, now: Date): DaylightView => {
  const day = deadline && adventureDay(point, deadline);
  const otherDay = day && day > now ? day : null;
  const { sunset, dark } = daylightOnDay(point, otherDay ?? midnightOf(now));
  const left = !otherDay && dark && dark > now && !isDark(point, now) ? dark.getTime() - now.getTime() : null;
  return { otherDay, sunset, dark, left };
};

export type ForecastView = {
  /** The Adventure Day the hours are of, when it is not today. */
  otherDay: Date | null;
  hours: (ForecastHour & { thunderstorm: boolean; dark: boolean; newDay: boolean })[];
  freezingLevelM: { low: number; high: number } | null;
  /** Every shown hour forecasts no rain or snow, so the table leaves the row out and says so in words. */
  dry: boolean;
  /** From when the forecast reaches an Adventure Day beyond it. */
  reachesFrom: Date | null;
};

/** The hours of the Adventure Day that are still to come, through to a Deadline the next morning, at least MIN_FORECAST_HOURS. */
export const forecastView = (forecast: ForecastHour[], point: Point, deadline: Date | null, now: Date): ForecastView => {
  const from = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const day = deadline ? adventureDay(point, deadline) : midnightOf(now);
  const lastHour = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23).getTime();
  const start = Math.max(from, day.getTime());
  const until = Math.max(lastHour, deadline?.getTime() ?? 0, start + (MIN_FORECAST_HOURS - 1) * HOUR_MS);
  const upcoming = forecast.filter((h) => h.at.getTime() >= from);
  const last = upcoming.at(-1);
  const hours = upcoming
    .filter((h) => h.at.getTime() >= start && h.at.getTime() <= until)
    .map((h, i, shown) => ({
      ...h,
      thunderstorm: THUNDERSTORM_CODES.has(h.weatherCode),
      dark: isDark(point, h.at),
      newDay: i > 0 && !sameDay(h.at, shown[i - 1]!.at),
    }));
  const freezing = hours.map((h) => h.freezingLevelM).filter((m): m is number => m !== null);
  return {
    otherDay: sameDay(day, now) ? null : day,
    hours,
    freezingLevelM: freezing.length > 0 ? { low: Math.min(...freezing), high: Math.max(...freezing) } : null,
    dry: hours.length > 0 && hours.every((h) => h.precipitationMm === 0),
    reachesFrom: last && until > last.at.getTime() ? new Date(until - (last.at.getTime() - from)) : null,
  };
};

type Kept = { point: Point; fetchedAt: string; forecast: (Omit<ForecastHour, 'at'> & { at: string })[]; bulletin: (Omit<AvalancheBulletin, 'validUntil'> & { validUntil: string }) | null };

const revive = (kept: Kept): FetchedConditions => ({
  fetchedAt: new Date(kept.fetchedAt),
  forecast: kept.forecast.map((h) => ({ ...h, at: new Date(h.at) })),
  bulletin: kept.bulletin && { ...kept.bulletin, validUntil: new Date(kept.bulletin.validUntil) },
});

export const createConditions = ({ fetchJson, storage, now, language }: ConditionsDeps) => {
  // Read once; storage is a synchronous database, and the list only changes here.
  let kept: Kept[] | null = null;
  const load = (): Kept[] => {
    if (kept) return kept;
    try {
      const parsed = JSON.parse(storage.getItem(KEY) || '[]') as unknown;
      kept = Array.isArray(parsed) ? (parsed as Kept[]) : [];
    } catch {
      kept = [];
    }
    return kept;
  };

  const keep = (point: Point, conditions: FetchedConditions) => {
    // A round trip through JSON turns the dates into the strings storage keeps.
    const entry = JSON.parse(JSON.stringify({ point, ...conditions })) as Kept;
    kept = [entry, ...load().filter((k) => !samePlace(k.point, point))].slice(0, KEPT);
    storage.setItem(KEY, JSON.stringify(kept));
  };

  // One bulletin covers every place, so the phone loads it once per language and refresh, not once per place.
  let slf: { language: AppLanguage; fetchedAt: number; features: Feature[] } | null = null;
  const slfFeatures = async (): Promise<Feature[]> => {
    const lang = language();
    if (slf && slf.language === lang && now().getTime() - slf.fetchedAt < CONDITIONS_REFRESH_MS) return slf.features;
    const json = (await fetchJson(slfUrl(lang))) as { features?: Feature[] };
    slf = { language: lang, fetchedAt: now().getTime(), features: json.features ?? [] };
    return slf.features;
  };

  const fetchConditions = async (point: Point): Promise<FetchedConditions> => {
    const [forecast, bulletin] = await Promise.all([
      fetchJson(openMeteoUrl(point)).then(parseForecast),
      inSlfArea(point) ? slfFeatures().then((features) => bulletinAt(features, point, now())).catch(() => null) : null,
    ]);
    return { fetchedAt: now(), forecast, bulletin };
  };

  return {
    /** The forecast and the avalanche bulletin at the point, fetched at most every CONDITIONS_REFRESH_MS. */
    at: async (exact: Point): Promise<ConditionsResult> => {
      const point = round(exact);
      const found = load().find((k) => samePlace(k.point, point));
      const last = found && revive(found);
      if (last && now().getTime() - last.fetchedAt.getTime() < CONDITIONS_REFRESH_MS) return { kind: 'shown', conditions: last };
      try {
        const conditions = await fetchConditions(point);
        keep(point, conditions);
        return { kind: 'shown', conditions };
      } catch {
        return last ? { kind: 'stale', conditions: last } : { kind: 'unavailable' };
      }
    },
  };
};
