type Point = { latitude: number; longitude: number };

export type Camera = { center: Point; zoom: number };

const MAX_ZOOM = 16;
const PADDING = 1.4;

// expo-maps turns a zoom into a square region of 360 / 2^zoom degrees, so the zoom follows from the larger span.
export const fitCamera = (points: readonly Point[]): Camera | null => {
  if (points.length === 0) return null;
  const latitudes = points.map((p) => p.latitude);
  const longitudes = points.map((p) => p.longitude);
  const [south, north] = [Math.min(...latitudes), Math.max(...latitudes)];
  const [west, east] = [Math.min(...longitudes), Math.max(...longitudes)];
  const zoom = Math.min(MAX_ZOOM, Math.log2(360 / (Math.max(north - south, east - west) * PADDING)));
  return { center: { latitude: (south + north) / 2, longitude: (west + east) / 2 }, zoom };
};

export type Region = { center: Point; latitudeDelta: number; longitudeDelta: number };

export const regionOf = (camera: Camera): Region => {
  const span = 360 / 2 ** camera.zoom;
  return { center: camera.center, latitudeDelta: span, longitudeDelta: span };
};

export const shows = (region: Region, point: Point) =>
  Math.abs(point.latitude - region.center.latitude) <= region.latitudeDelta / 2 &&
  Math.abs(point.longitude - region.center.longitude) <= region.longitudeDelta / 2;
