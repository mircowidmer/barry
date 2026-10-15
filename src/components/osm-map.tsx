import type { LastKnown, TrailPoint } from '@/lib/trail-map/types';

export type OsmMapProps = { trail: TrailPoint[]; last: LastKnown | null };

export function OsmMap(_: OsmMapProps) {
  return null;
}
