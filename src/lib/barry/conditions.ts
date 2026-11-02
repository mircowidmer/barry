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

/** `unavailable` when the bulletin could not be loaded, so a missing bulletin never looks like no danger. */
type FetchedConditions = { fetchedAt: Date; forecast: ForecastHour[]; bulletin: AvalancheBulletin | 'unavailable' | null };

export type ConditionsResult =
  | { kind: 'shown' | 'stale'; conditions: FetchedConditions }
  | { kind: 'unavailable' };

type ConditionsDeps = {
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

/** The cell of the forecast's grid the point falls in: one place to the Conditions. */
export const placeKey = (point: Point) => {
  const { latitude, longitude } = round(point);
  return `${latitude},${longitude}`;
};

const openMeteoUrl = ({ latitude, longitude }: Point) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
  '&hourly=temperature_2m,precipitation,wind_gusts_10m,weather_code,freezing_level_height&timeformat=unixtime&forecast_days=7';

const slfUrl = (language: AppLanguage) => `https://aws.slf.ch/api/bulletin/caaml/${language}/geojson`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// An hour without a time, a temperature, a weather code or gusts has no forecast, so it is left out rather than shown as 0° and clear.
const parseForecast = (json: unknown): ForecastHour[] => {
  const hourly = isRecord(json) && isRecord(json.hourly) ? json.hourly : null;
  if (!hourly) throw new Error('Open-Meteo answered without hourly data');
  const series = (key: string) => list(hourly[key]);
  const temperature = series('temperature_2m');
  const precipitation = series('precipitation');
  const gusts = series('wind_gusts_10m');
  const codes = series('weather_code');
  const freezing = series('freezing_level_height');
  return series('time').flatMap((time, i) => {
    const at = num(time);
    const temperatureC = num(temperature[i]);
    const gustsKmh = num(gusts[i]);
    const weatherCode = num(codes[i]);
    if (at === null || temperatureC === null || gustsKmh === null || weatherCode === null) return [];
    return [
      {
        at: new Date(at * 1000),
        temperatureC,
        precipitationMm: num(precipitation[i]),
        gustsKmh,
        weatherCode,
        freezingLevelM: num(freezing[i]),
      },
    ];
  });
};

type Ring = [number, number][];
type Feature = {
  properties: { validTime: { startTime: string; endTime: string }; dangerRatings?: unknown; avalancheProblems?: unknown };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } | null;
};

// What the bulletin needs of a GeoJSON feature; a feature of another shape is left out rather than read blindly.
const isFeature = (value: unknown): value is Feature => {
  if (!isRecord(value) || !isRecord(value.properties) || !isRecord(value.properties.validTime)) return false;
  const { startTime, endTime } = value.properties.validTime;
  const geometry = value.geometry;
  return (
    typeof startTime === 'string' &&
    typeof endTime === 'string' &&
    (geometry == null ||
      (isRecord(geometry) && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') && Array.isArray(geometry.coordinates)))
  );
};

// Even-odd ray casting over every ring, so holes count as outside.
const inside = ({ latitude: y, longitude: x }: Point, rings: Ring[]) => {
  let crossings = 0;
  for (const ring of rings) {
    // Each edge runs from the previous vertex to this one, starting with the edge that closes the ring.
    let previous = ring.at(-1);
    if (!previous) continue;
    for (const vertex of ring) {
      const [xi, yi] = vertex;
      const [xj, yj] = previous;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) crossings++;
      previous = vertex;
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
  const rated = list(feature.properties.dangerRatings)
    .filter(isRecord)
    .map((r) => ({
      level: DANGER_LEVELS.indexOf(String(r.mainValue)) + 1,
      subdivision: isRecord(r.customData) && isRecord(r.customData.CH) ? r.customData.CH.subdivision : undefined,
    }))
    .filter((r) => r.level > 0);
  if (rated.length === 0) return null;
  const highest = rated.reduce((a, b) => (b.level > a.level ? b : a));
  const subdivision = SUBDIVISIONS.find((s) => s === highest.subdivision) ?? null;
  return {
    level: highest.level,
    subdivision,
    problems: [
      ...new Set(
        list(feature.properties.avalancheProblems)
          .filter(isRecord)
          .map((p) => p.problemType)
          .filter((p): p is string => typeof p === 'string'),
      ),
    ],
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
  /** The Adventure Day when it still lies ahead; sunset and Dark are then that day's. */
  otherDay: Date | null;
  sunset: Date | null;
  dark: Date | null;
  /** How long until Dark today, or null when Dark has fallen, is on another day or does not come. */
  left: number | null;
};

/** Sunset and Dark at the point on the Adventure Day, or today's with the daylight left. */
export const daylightView = (point: Point, deadline: Date, now: Date): DaylightView => {
  const day = adventureDay(point, deadline);
  const otherDay = day > now ? day : null;
  const { sunset, dark } = daylightOnDay(point, otherDay ?? midnightOf(now));
  const left = !otherDay && dark && dark > now && !isDark(point, now) ? dark.getTime() - now.getTime() : null;
  return { otherDay, sunset, dark, left };
};

/** The clock as the forecast view reads it: the hour, so the view changes once an hour, and the day, for the Adventure Day. */
type ViewClock = { hour: number; dayStart: number };

export const viewClock = (now: Date): ViewClock => ({ hour: Math.floor(now.getTime() / HOUR_MS), dayStart: midnightOf(now).getTime() });

export type ForecastView = {
  /** The Adventure Day the hours are of, when it still lies ahead. */
  otherDay: Date | null;
  hours: (ForecastHour & { thunderstorm: boolean; dark: boolean; newDay: boolean })[];
  freezingLevelM: { low: number; high: number } | null;
  /** Every shown hour forecasts no rain or snow, so the table leaves the row out and says so in words. */
  dry: boolean;
  /** From when the forecast reaches an Adventure Day beyond it. */
  reachesFrom: Date | null;
};

/** The hours of the Adventure Day that are still to come, through to a Deadline the next morning, at least MIN_FORECAST_HOURS; null when the forecast has nothing to say about the day. */
export const forecastView = (forecast: ForecastHour[], point: Point, deadline: Date, clock: ViewClock): ForecastView | null => {
  const from = clock.hour * HOUR_MS;
  const day = adventureDay(point, deadline);
  const lastHour = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23).getTime();
  const start = Math.max(from, day.getTime());
  const until = Math.max(lastHour, deadline.getTime(), start + (MIN_FORECAST_HOURS - 1) * HOUR_MS);
  const upcoming = forecast.filter((h) => h.at.getTime() >= from);
  const last = upcoming.at(-1);
  const hours = upcoming
    .filter((h) => h.at.getTime() >= start && h.at.getTime() <= until)
    .map((h, i, shown) => {
      const previous = shown[i - 1];
      return {
        ...h,
        thunderstorm: THUNDERSTORM_CODES.has(h.weatherCode),
        dark: isDark(point, h.at),
        newDay: previous !== undefined && !sameDay(h.at, previous.at),
      };
    });
  const reachesFrom = last && lastHour > last.at.getTime() ? new Date(lastHour - (last.at.getTime() - from)) : null;
  if (hours.length === 0 && !reachesFrom) return null;
  const freezing = hours.map((h) => h.freezingLevelM).filter((m): m is number => m !== null);
  return {
    otherDay: day.getTime() > clock.dayStart ? day : null,
    hours,
    freezingLevelM: freezing.length > 0 ? { low: Math.min(...freezing), high: Math.max(...freezing) } : null,
    dry: hours.length > 0 && hours.every((h) => h.precipitationMm === 0),
    reachesFrom,
  };
};

type Kept = { point: Point; fetchedAt: string; forecast: (Omit<ForecastHour, 'at'> & { at: string })[]; bulletin: (Omit<AvalancheBulletin, 'validUntil'> & { validUntil: string }) | 'unavailable' | null };

// A kept entry the app wrote itself; whatever else storage holds, such as an older build's shape, is dropped.
const isKept = (value: unknown): value is Kept =>
  isRecord(value) &&
  isRecord(value.point) &&
  num(value.point.latitude) !== null &&
  num(value.point.longitude) !== null &&
  typeof value.fetchedAt === 'string' &&
  Array.isArray(value.forecast) &&
  (value.bulletin === null || value.bulletin === 'unavailable' || isRecord(value.bulletin));

const revive = (kept: Kept): FetchedConditions => ({
  fetchedAt: new Date(kept.fetchedAt),
  forecast: kept.forecast.map((h) => ({ ...h, at: new Date(h.at) })),
  bulletin: typeof kept.bulletin === 'object' && kept.bulletin ? { ...kept.bulletin, validUntil: new Date(kept.bulletin.validUntil) } : kept.bulletin,
});

export const createConditions = ({ fetchJson, storage, now, language }: ConditionsDeps) => {
  // Read once; storage is a synchronous database, and the list only changes here.
  let kept: Kept[] | null = null;
  const load = (): Kept[] => {
    if (kept) return kept;
    try {
      // || rather than ??: forget() leaves an empty string behind.
      const parsed: unknown = JSON.parse(storage.getItem(KEY) || '[]');
      kept = list(parsed).filter(isKept);
    } catch {
      kept = [];
    }
    return kept;
  };

  const keep = (point: Point, conditions: FetchedConditions) => {
    const { bulletin } = conditions;
    const entry: Kept = {
      point,
      fetchedAt: conditions.fetchedAt.toISOString(),
      forecast: conditions.forecast.map((h) => ({ ...h, at: h.at.toISOString() })),
      bulletin: typeof bulletin === 'object' && bulletin ? { ...bulletin, validUntil: bulletin.validUntil.toISOString() } : bulletin,
    };
    kept = [entry, ...load().filter((k) => !samePlace(k.point, point))].slice(0, KEPT);
    storage.setItem(KEY, JSON.stringify(kept));
  };

  // One bulletin covers every place, so the phone loads it once per language and refresh, not once per place.
  let slf: { language: AppLanguage; fetchedAt: number; features: Feature[] } | null = null;
  const slfFeatures = async (): Promise<Feature[]> => {
    const lang = language();
    if (slf && slf.language === lang && now().getTime() - slf.fetchedAt < CONDITIONS_REFRESH_MS) return slf.features;
    const json = await fetchJson(slfUrl(lang));
    const features = isRecord(json) && Array.isArray(json.features) ? json.features : null;
    // A feed of another shape fails the load, so it shows as unavailable and never as no danger.
    if (!features || !features.every(isFeature)) throw new Error('the SLF answered with features of another shape');
    slf = { language: lang, fetchedAt: now().getTime(), features };
    return slf.features;
  };

  const fetchConditions = async (point: Point, last: FetchedConditions | undefined): Promise<FetchedConditions> => {
    // A bulletin that failed to load gives way to the last one while it is still valid.
    const lastValid = typeof last?.bulletin === 'object' && last.bulletin && last.bulletin.validUntil > now() ? last.bulletin : null;
    const [forecast, bulletin] = await Promise.all([
      fetchJson(openMeteoUrl(point)).then(parseForecast),
      inSlfArea(point)
        ? slfFeatures()
            .then((features) => bulletinAt(features, point, now()))
            .catch(() => lastValid ?? ('unavailable' as const))
        : null,
    ]);
    return { fetchedAt: now(), forecast, bulletin };
  };

  return {
    /** The forecast and the avalanche bulletin at the point, fetched at most every CONDITIONS_REFRESH_MS. */
    at: async (exact: Point): Promise<ConditionsResult> => {
      const point = round(exact);
      const found = load().find((k) => samePlace(k.point, point));
      const last = found && revive(found);
      // Without its bulletin the Conditions are not fresh, so the next look asks again.
      const fresh = last && last.bulletin !== 'unavailable' && now().getTime() - last.fetchedAt.getTime() < CONDITIONS_REFRESH_MS;
      if (fresh) return { kind: 'shown', conditions: last };
      try {
        const conditions = await fetchConditions(point, last);
        keep(point, conditions);
        return { kind: 'shown', conditions };
      } catch {
        return last ? { kind: 'stale', conditions: last } : { kind: 'unavailable' };
      }
    },
    /** Drops the kept Conditions, whose points tell where the Adventurer planned to go. */
    forget: () => {
      kept = [];
      storage.setItem(KEY, '');
    },
  };
};
