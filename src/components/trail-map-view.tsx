import { AppleMaps } from 'expo-maps';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { fitCamera } from '@/lib/trail-map/camera';
import { formatWhen } from '@/lib/wording';
import type { LastKnown, TrailPoint } from '@/lib/trail-map/types';

export type TrailMapViewProps = { trail: TrailPoint[]; last: LastKnown | null };

const TRAIL = '#208AEF';
const LAST = '#E5484D';

const at = (p: TrailPoint) => ({ latitude: p.latitude, longitude: p.longitude });

export function TrailMapView({ trail, last }: TrailMapViewProps) {
  const map = useRef<AppleMaps.MapView>(null);
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
      polylines={coordinates.length > 1 ? [{ id: 'trail', coordinates, color: TRAIL, width: 4 }] : []}
      circles={[
        ...coordinates.map((center, i) => ({
          id: `reading-${i}`,
          center,
          radius: camera.dotRadiusM,
          color: TRAIL,
          lineColor: '#fff',
          lineWidth: 1.5,
        })),
        ...(last?.accuracyM
          ? [{ id: 'accuracy', center: at(last), radius: last.accuracyM, color: 'rgba(32,138,239,0.15)', lineColor: TRAIL, lineWidth: 1 }]
          : []),
      ]}
      markers={
        last
          ? [
              {
                id: 'last',
                coordinates: at(last),
                tintColor: LAST,
                title: `Last Known Position, ${formatWhen(last.takenAt)}`,
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
