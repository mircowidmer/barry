import type { TrailBuffer, TrailSendOutcome } from './trail-buffer';
import type { AdventureId, Point, Position, RawLocation, Refusal, Trail, TrailStatus } from './types';

export const TRAIL_LOCATION_TASK = 'barry.trail.location';
export const TRAIL_FENCE_TASK = 'barry.trail.fence';

const FENCE_MOVE_M = 50;
const TRAIL_RADIUS_M = 200;
// How close to the destination's point the phone shows the Arrival Notice.
export const ARRIVAL_RADIUS_M = 150;

const TRAIL_REGION = 'trail';
const ARRIVAL_REGION = 'arrival.';

/**
 * A region iOS watches. Both live in the one fence task: expo-location restarts every region of the
 * app whenever any geofence task changes, so a second task would lose its region each time the
 * Trail's fence moves.
 */
export type Fence = { identifier: string; center: Point; radiusM: number; notifyOn: 'enter' | 'exit' };

export type LocationService = {
  backgroundPermitted(): Promise<boolean>;
  requestBackground(): Promise<boolean>;
  startUpdates(mode: Exclude<TrailStatus, 'off'>): Promise<void>;
  stopUpdates(): Promise<void>;
  /** Replaces the watched regions. None stops the fence task. */
  setFences(fences: Fence[]): Promise<void>;
  lastReading(): Promise<Position | null>;
};

export type RecordTrailResponse = { data: Refusal | null; error: { message: string } | null };

export type TrailDeps = {
  location: LocationService;
  buffer: TrailBuffer;
  signedIn(): Promise<boolean>;
  inProgressId(): AdventureId | null;
  /** Where the Adventure in progress is headed, if the Adventurer put it on the map. */
  destinationPoint(): Point | null;
  /** The phone entered the destination's region of this Adventure. */
  arrived(id: AdventureId): Promise<void>;
  pendingCheckIn(): boolean;
  flushCheckIns(): Promise<void>;
  recordTrail(id: AdventureId, batch: readonly Position[]): Promise<RecordTrailResponse>;
};

export type TrailFacts = {
  signedIn: boolean;
  permitted: boolean;
  pendingCheckIn: boolean;
  inProgressId: AdventureId | null;
};

export const trailMode = ({ signedIn, permitted, pendingCheckIn, inProgressId }: TrailFacts): TrailStatus =>
  !signedIn || !permitted ? 'off' : pendingCheckIn ? 'delivering' : inProgressId ? 'recording' : 'off';

const trailOutcome = ({ data, error }: RecordTrailResponse): TrailSendOutcome =>
  error ? 'retry' : data === null ? 'accepted' : 'refused';

const toReading = (l: RawLocation): Position => ({
  takenAt: new Date(l.timestamp),
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  accuracyM: l.coords.accuracy ?? null,
});

const metresBetween = (a: Point, b: Point) => {
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
  destinationPoint,
  arrived,
  pendingCheckIn,
  flushCheckIns,
  recordTrail,
}: TrailDeps): Trail => {
  let fence: Position | null = null;
  // The regions last handed to iOS. Null until the first since the launch, so a relaunch sets them once.
  let applied: Fence[] | null = null;

  const flush = () => buffer.flush(async (id, batch) => trailOutcome(await recordTrail(id, batch)));

  const facts = async (): Promise<TrailFacts> => ({
    signedIn: await signedIn(),
    permitted: await location.backgroundPermitted(),
    pendingCheckIn: pendingCheckIn(),
    inProgressId: inProgressId(),
  });

  const fences = (center: Position | null, id: AdventureId | null): Fence[] => {
    const destination = id ? destinationPoint() : null;
    return [
      ...(center ? [{ identifier: TRAIL_REGION, center, radiusM: TRAIL_RADIUS_M, notifyOn: 'exit' as const }] : []),
      ...(id && destination
        ? [{ identifier: `${ARRIVAL_REGION}${id}`, center: destination, radiusM: ARRIVAL_RADIUS_M, notifyOn: 'enter' as const }]
        : []),
    ];
  };

  // A Trail fence that moved less than FENCE_MOVE_M counts as unchanged.
  const sameFences = (a: Fence[], b: Fence[]) =>
    a.length === b.length &&
    a.every((f, i) => {
      const g = b[i];
      return (
        g !== undefined &&
        f.identifier === g.identifier &&
        (f.identifier === TRAIL_REGION
          ? metresBetween(f.center, g.center) <= FENCE_MOVE_M
          : f.center.latitude === g.center.latitude && f.center.longitude === g.center.longitude)
      );
    });

  // The Trail's fence only brings the Trail back after a force-quit. When iOS refuses the fences,
  // recording and uploading go on without them, and there is no Arrival Notice. Setting them restarts
  // every region and makes iOS report each one again, so unchanged fences are left alone.
  const moveFence = async (center: Position | null, id: AdventureId | null) => {
    const wanted = fences(center, id);
    if (applied && sameFences(applied, wanted)) return;
    try {
      await location.setFences(wanted);
      applied = wanted;
      fence = center;
    } catch {}
  };

  const sync = async (): Promise<TrailStatus> => {
    const now = await facts();
    const mode = trailMode(now);
    if (mode === 'off') await location.stopUpdates();
    else await location.startUpdates(mode);
    buffer.keepOnly(now.signedIn && !now.pendingCheckIn ? now.inProgressId : null);
    const id = mode === 'recording' ? now.inProgressId : null;
    const center = id ? buffer.newest(id) : null;
    await flush();
    await moveFence(id ? (center ?? (await location.lastReading())) : null, id);
    return mode;
  };

  const quietly = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch {}
  };

  const wake = async (): Promise<AdventureId | null> => {
    const now = await facts();
    const mode = trailMode(now);
    if (mode === 'delivering') await flushCheckIns().catch(() => undefined);
    return mode === 'recording' ? now.inProgressId : null;
  };

  return {
    sync,
    status: async () => trailMode(await facts()),
    requestPermission: () => location.requestBackground(),

    onLocations: (locations) =>
      quietly(async () => {
        const id = await wake();
        if (!id) {
          await sync();
          return;
        }
        buffer.add(id, locations.map(toReading));
        const newest = buffer.newest(id);
        await flush();
        if (newest && (!fence || metresBetween(fence, newest) > FENCE_MOVE_M)) await moveFence(newest, id);
      }),

    onFenceEvent: ({ region, entered }) =>
      quietly(async () => {
        // iOS also reports the state of each region whenever the fences are set, so this fires again
        // while the Adventurer stays at the destination. `arrived` shows the notice once.
        if (region.startsWith(ARRIVAL_REGION)) {
          if (entered) await arrived(region.slice(ARRIVAL_REGION.length) as AdventureId);
          return;
        }
        // The Trail's fence is centred on the newest reading, so iOS reports it entered each time it
        // is set. Acting on that would move the fence and set it again, in a loop. Only leaving counts.
        if (entered) return;
        const id = await wake();
        const reading = id ? await location.lastReading() : null;
        if (id && reading) buffer.add(id, [reading]);
        await sync();
      }),
  };
};
