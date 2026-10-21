import { AppleMaps } from 'expo-maps';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { Point } from '@/lib/barry';
import { useTexts } from '@/lib/texts';

export type MapCamera = { center: Point; zoom: number };

export type DestinationMapProps = { point: Point | null; camera: MapCamera; onPick: (point: Point) => void };

/** Where the destination is: a tap on the map puts the pin there. */
export function DestinationMap({ point, camera, onPick }: DestinationMapProps) {
  const theme = useTheme();
  const t = useTexts();
  const map = useRef<AppleMaps.MapView>(null);
  const [cameraPosition] = useState({ coordinates: camera.center, zoom: camera.zoom });
  // A place found again moves the camera; the Adventurer's own panning stays otherwise.
  useEffect(() => {
    map.current?.setCameraPosition({ coordinates: camera.center, zoom: camera.zoom });
  }, [camera]);

  if (Platform.OS !== 'ios') return null;

  return (
    <AppleMaps.View
      ref={map}
      style={styles.map}
      cameraPosition={cameraPosition}
      uiSettings={{ myLocationButtonEnabled: false, scaleBarEnabled: true, togglePitchEnabled: false }}
      // expo-maps keeps map places selectable even with selectionEnabled off, so the map shows none.
      properties={{ selectionEnabled: false, pointsOfInterest: { including: [] } }}
      onMapClick={({ coordinates: { latitude, longitude } }) => {
        if (latitude !== undefined && longitude !== undefined) onPick({ latitude, longitude });
      }}
      markers={point ? [{ id: 'destination', coordinates: point, tintColor: theme.accent, title: t.plan.destination }] : []}
    />
  );
}

const styles = StyleSheet.create({
  map: { height: 240, width: '100%', borderRadius: 12, overflow: 'hidden' },
});
