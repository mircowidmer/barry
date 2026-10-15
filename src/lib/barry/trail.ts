import type { TrailBuffer, TrailSendOutcome } from './trail-buffer';
import type { AdventureId, Position, RawLocation, Refusal, Trail, TrailStatus } from './types';

export const TRAIL_LOCATION_TASK = 'barry.trail.location';
export const TRAIL_FENCE_TASK = 'barry.trail.fence';

const FENCE_MOVE_M = 50;

export type LocationService = {
  backgroundPermitted(): Promise<boolean>;
  requestBackground(): Promise<boolean>;
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
  setFence(center: Position | null): Promise<void>;
  lastReading(): Promise<Position | null>;
};

export type RecordTrailResponse = { data: Refusal | null; error: { message: string } | null };

export type TrailDeps = {
  location: LocationService;
  buffer: TrailBuffer;
  signedIn(): Promise<boolean>;
  inProgressId(): AdventureId | null;
  checkInQueued(id: AdventureId): boolean;
  recordTrail(id: AdventureId, batch: readonly Position[]): Promise<RecordTrailResponse>;
};

export const trailOutcome = ({ data, error }: RecordTrailResponse): TrailSendOutcome =>
  error ? 'retry' : data === null ? 'accepted' : 'refused';

const toReading = (l: RawLocation): Position => ({
  takenAt: new Date(l.timestamp),
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  accuracyM: l.coords.accuracy ?? null,
});

const metresBetween = (a: Position, b: Position) => {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

export const createTrail = ({
  location,
  buffer,
  signedIn,
  inProgressId,
  checkInQueued,
  recordTrail,
}: TrailDeps): Trail => {
  let fence: Position | null = null;

  const flush = () => buffer.flush(async (id, batch) => trailOutcome(await recordTrail(id, batch)));

  const liveId = async (): Promise<AdventureId | null> => {
    const id = inProgressId();
    return id && !checkInQueued(id) && (await signedIn()) ? id : null;
  };

  const recordingFor = async (): Promise<AdventureId | null> => {
    const id = await liveId();
    return id && (await location.backgroundPermitted()) ? id : null;
  };

  // The fence only brings the Trail back after a force-quit. When iOS refuses it, recording and
  // uploading go on without it.
  const moveFence = async (center: Position | null) => {
    try {
      await location.setFence(center);
      fence = center;
    } catch {}
  };

  const sync = async (): Promise<TrailStatus> => {
    const id = await recordingFor();
    if (id) await location.startUpdates();
    else await location.stopUpdates();
    buffer.keepOnly(await liveId());
    const center = id ? buffer.newest(id) : null;
    await flush();
    await moveFence(id ? (center ?? (await location.lastReading())) : null);
    return id ? 'recording' : 'off';
  };

  const quietly = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch {}
  };

  return {
    sync,
    status: async () => ((await recordingFor()) ? 'recording' : 'off'),
    requestPermission: () => location.requestBackground(),

    onLocations: (locations) =>
      quietly(async () => {
        const id = await recordingFor();
        if (!id) {
          await sync();
          return;
        }
        buffer.add(id, locations.map(toReading));
        const newest = buffer.newest(id);
        await flush();
        if (newest && (!fence || metresBetween(fence, newest) > FENCE_MOVE_M)) await moveFence(newest);
      }),

    onFenceExit: () =>
      quietly(async () => {
        const id = await recordingFor();
        const reading = id ? await location.lastReading() : null;
        if (id && reading) buffer.add(id, [reading]);
        await sync();
      }),
  };
};
