import type { DestinationMapProps, DestinationPreviewProps } from './destination-map';

export type { DestinationMapProps, DestinationPreviewProps, MapCamera } from './destination-map';

// The web build has no app, so nobody plans an Adventure there.
export function DestinationPreview(_: DestinationPreviewProps) {
  return null;
}

export function DestinationMap(_: DestinationMapProps) {
  return null;
}
