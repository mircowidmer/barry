import type { Point } from './types';

/** How far below the horizon the sun is at Dark, the end of civil twilight, in degrees. */
export const DARK_ALTITUDE = -6;
// The sun's upper edge touches the horizon, with refraction.
const SUNSET_ALTITUDE = -0.833;

const DAY_MS = 86_400_000;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

// NOAA's low-precision solar formulas, good to a minute or two.
const sun = (at: Date) => {
  const startOfYear = Date.UTC(at.getUTCFullYear(), 0, 1);
  const g = ((2 * Math.PI) / 365) * ((at.getTime() - startOfYear) / DAY_MS);
  const eqTimeMin =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return { eqTimeMin, declination };
};

/** The sun's height above the horizon at the point, in degrees. */
export const sunAltitude = (point: Point, at: Date) => {
  const { eqTimeMin, declination } = sun(at);
  const utcMin = (at.getTime() % DAY_MS) / 60_000;
  const hourAngle = rad((utcMin + eqTimeMin + 4 * point.longitude) / 4 - 180);
  const lat = rad(point.latitude);
  return deg(Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)));
};

export const isDark = (point: Point, at: Date) => sunAltitude(point, at) < DARK_ALTITUDE;

export type Daylight = { sunset: Date | null; dark: Date | null };

/** Sunset and Dark of the day `on` falls in at the point; null where the sun stays above that height all night or never gets there. */
export const daylightOn = (point: Point, on: Date): Daylight => {
  // The point's own day, so a place far east or west does not get its neighbour's evening.
  const local = new Date(on.getTime() + (point.longitude / 360) * DAY_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const { eqTimeMin, declination } = sun(new Date(midnight + DAY_MS / 2));
  const noon = midnight + (720 - 4 * point.longitude - eqTimeMin) * 60_000;
  const lat = rad(point.latitude);
  const setting = (altitude: number) => {
    const cos = (Math.sin(rad(altitude)) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
    return cos < -1 || cos > 1 ? null : new Date(noon + 4 * deg(Math.acos(cos)) * 60_000);
  };
  return { sunset: setting(SUNSET_ALTITUDE), dark: setting(DARK_ALTITUDE) };
};

/** The Dark that most recently fell before `at`, such as the evening before a Deadline before dawn. */
export const lastDarkBefore = (point: Point, at: Date): Date | null => {
  const today = daylightOn(point, at).dark;
  if (today && today.getTime() <= at.getTime()) return today;
  return daylightOn(point, new Date(at.getTime() - DAY_MS)).dark;
};
