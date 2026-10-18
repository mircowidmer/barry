import { AppleMaps } from 'expo-maps';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { fitCamera } from '@/lib/trail-map/camera';
import { formatWhen } from '@/lib/wording';
import type { LastKnown, TrailPoint } from '@/lib/trail-map/types';

export type TrailMapViewProps = { trail: TrailPoint[]; last: LastKnown | null };

const at = (p: TrailPoint) => ({ latitude: p.latitude, longitude: p.longitude });

const translucent = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
};

export function TrailMapView({ trail, last }: TrailMapViewProps) {
  const map = useRef<AppleMaps.MapView>(null);
  const theme = useTheme();
  const camera = fitCamera(last ? [...trail, last] : trail);
  const [latitude, longitude, zoom] = [camera?.center.latitude, camera?.center.longitude, camera?.zoom];

  useEffect(() => {
    if (zoom !== undefined) map.current?.setCameraPosition({ coordinates: { latitude, longitude }, zoom });
  }, [latitude, longitude, zoom]);

  if (Platform.OS !== 'ios' || !camera) return null;

  const coordinates = trail.map(at);
  return (
    <AppleMaps.View
      ref={map}
      style={styles.map}
      cameraPosition={{ coordinates: camera.center, zoom: camera.zoom }}
      uiSettings={{ myLocationButtonEnabled: false, scaleBarEnabled: true, togglePitchEnabled: false }}
      // expo-maps keeps map places selectable even with selectionEnabled off, so the map shows none.
      properties={{ selectionEnabled: false, pointsOfInterest: { including: [] } }}
      polylines={coordinates.length > 1 ? [{ id: 'trail', coordinates, color: theme.accent, width: 4 }] : []}
      circles={[
        ...coordinates.map((center, i) => ({
          id: `reading-${i}`,
          center,
          radius: camera.dotRadiusM,
          color: theme.accent,
          lineColor: '#fff',
          lineWidth: 1.5,
        })),
        ...(last?.accuracyM
          ? [{ id: 'accuracy', center: at(last), radius: last.accuracyM, color: translucent(theme.accent, 0.15), lineColor: theme.accent, lineWidth: 1 }]
          : []),
      ]}
      markers={
        last
          ? [
              {
                id: 'last',
                coordinates: at(last),
                tintColor: theme.text,
                title: `Last known position, ${formatWhen(last.takenAt)}`,
              },
            ]
          : []
      }
    />
  );
}

const styles = StyleSheet.create({
  map: { height: 320, width: '100%', borderRadius: 12, overflow: 'hidden' },
});
