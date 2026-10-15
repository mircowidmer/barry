export type Plan = { destination: string; route: string | null; startingPoint: string | null; notes: string | null };

export type TrailPoint = { latitude: number; longitude: number; takenAt: Date };
export type LastKnown = TrailPoint & { accuracyM: number | null };

type Base = { adventurerName: string; plan: Plan; timeZone: string };

export type TrailMap =
  | (Base & { status: 'underway' | 'alerted'; trail: TrailPoint[]; lastKnownPosition: LastKnown | null })
  | (Base & { status: 'checked_in'; checkedInAt: Date });

export type TrailMapView =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'ready'; map: TrailMap }
  | { kind: 'offline'; since: Date; last: TrailMap | null };
