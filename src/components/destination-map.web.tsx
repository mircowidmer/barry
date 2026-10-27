import type { DestinationMapProps } from './destination-map';

export type { DestinationMapProps, MapCamera } from './destination-map';

// The web build has no app, so nobody plans an Adventure there.
export function DestinationMap(_: DestinationMapProps) {
  return null;
}
