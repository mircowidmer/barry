import type { LastKnown, Plan, TrailMap, TrailPoint } from './types';

const TOKEN = /^#([A-Za-z0-9_-]{22})$/;
const FORBIDDEN = ['deadline', 'alert_at', 'stage', 'profile'];

export const tokenFromHash = (hash: string): string | null => TOKEN.exec(hash)?.[1] ?? null;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const date = (value: unknown): Date | null => {
  const at = typeof value === 'string' ? new Date(value) : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
};

const plan = (value: unknown): Plan | null => {
  if (!isObject(value)) return null;
  const destination = text(value.destination);
  return destination
    ? { destination, route: text(value.route), startingPoint: text(value.starting_point), notes: text(value.notes) }
    : null;
};

const point = (value: unknown): TrailPoint | null => {
  if (!Array.isArray(value)) return null;
  const [latitude, longitude, takenAt] = [number(value[0]), number(value[1]), date(value[2])];
  return latitude !== null && longitude !== null && takenAt ? { latitude, longitude, takenAt } : null;
};

const lastKnown = (value: unknown): LastKnown | null | undefined => {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  const p = point([value.latitude, value.longitude, value.taken_at]);
  return p ? { ...p, accuracyM: number(value.accuracy_m) } : undefined;
};

export const parseTrailMap = (json: unknown): TrailMap | null => {
  if (!isObject(json) || FORBIDDEN.some((key) => key in json)) return null;
  const adventurerName = text(json.adventurer_name);
  const timeZone = text(json.time_zone);
  const p = plan(json.plan);
  if (!adventurerName || !timeZone || !p) return null;
  const base = { adventurerName, timeZone, plan: p };

  switch (json.status) {
    case 'underway':
    case 'alerted': {
      if (!Array.isArray(json.trail)) return null;
      const trail = json.trail.map(point);
      const last = lastKnown(json.last_known_position ?? null);
      if (trail.some((t) => t === null) || last === undefined) return null;
      return { ...base, status: json.status, trail: trail as TrailPoint[], lastKnownPosition: last };
    }
    case 'checked_in': {
      const checkedInAt = date(json.checked_in_at);
      return checkedInAt && !('trail' in json) ? { ...base, status: 'checked_in', checkedInAt } : null;
    }
    default:
      return null;
  }
};

export const newestReading = (map: TrailMap | null): Date | null =>
  map && map.status !== 'checked_in' ? (map.trail.at(-1)?.takenAt ?? null) : null;

/** Adds the readings in an answer for `newestReading(shown)` to the Trail already shown. */
export const mergeTrailMap = (shown: TrailMap | null, update: TrailMap): TrailMap => {
  if (!shown || shown.status === 'checked_in' || update.status === 'checked_in') return update;
  const newest = newestReading(shown);
  const fresh = newest ? update.trail.filter((p) => p.takenAt > newest) : update.trail;
  return { ...update, trail: [...shown.trail, ...fresh] };
};

export const fetchTrailMap =
  (fetchFn: typeof fetch, base: string, key: string) =>
  async (token: string, after: Date | null = null): Promise<TrailMap | null | 'offline'> => {
    try {
      const response = await fetchFn(`${base}/rest/v1/rpc/trail_map`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify(after ? { p_token: token, p_after: after.toISOString() } : { p_token: token }),
      });
      if (!response.ok) return 'offline';
      return parseTrailMap(await response.json());
    } catch {
      return 'offline';
    }
  };
