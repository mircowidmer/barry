type Point = { latitude: number; longitude: number };

export type Camera = { center: Point; zoom: number; dotRadiusM: number };

const MAX_ZOOM = 16;
const PADDING = 1.4;
const METERS_PER_DEGREE_LATITUDE = 111_000;
const DOT_SHARE_OF_SPAN = 1 / 80;

// expo-maps turns a zoom into a square region of 360 / 2^zoom degrees, so the zoom follows from the larger span.
export const fitCamera = (points: readonly Point[]): Camera | null => {
  if (points.length === 0) return null;
  const latitudes = points.map((p) => p.latitude);
  const longitudes = points.map((p) => p.longitude);
  const [south, north] = [Math.min(...latitudes), Math.max(...latitudes)];
  const [west, east] = [Math.min(...longitudes), Math.max(...longitudes)];
  const zoom = Math.min(MAX_ZOOM, Math.log2(360 / (Math.max(north - south, east - west) * PADDING)));
  const span = 360 / 2 ** zoom;
  return {
    center: { latitude: (south + north) / 2, longitude: (west + east) / 2 },
    zoom,
    dotRadiusM: span * METERS_PER_DEGREE_LATITUDE * DOT_SHARE_OF_SPAN,
  };
};
