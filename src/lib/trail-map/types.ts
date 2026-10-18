export type Plan = { destination: string; route: string | null };

export type TrailPoint = { latitude: number; longitude: number; takenAt: Date };
export type LastKnown = TrailPoint & { accuracyM: number | null };

type Base = { adventurerName: string; plan: Plan; trail: TrailPoint[]; lastKnownPosition: LastKnown | null };

export type TrailMap = Base & ({ status: 'underway' | 'alerted' } | { status: 'checked_in'; checkedInAt: Date });

export type TrailMapState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'ready'; map: TrailMap }
  | { kind: 'offline'; since: Date; last: TrailMap | null };
