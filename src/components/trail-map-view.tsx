import { useImage } from 'expo-image';
import { AppleMaps } from 'expo-maps';
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { fitCamera } from '@/lib/trail-map/camera';
import type { LastKnown, TrailPoint } from '@/lib/trail-map/types';
import { useTexts } from '@/lib/texts';

export type TrailMapViewProps = { trail: TrailPoint[]; last: LastKnown | null };

const at = (p: TrailPoint) => ({ latitude: p.latitude, longitude: p.longitude });

const translucent = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
};

export function TrailMapView({ trail, last }: TrailMapViewProps) {
  const theme = useTheme();
  const t = useTexts();
  // expo-maps draws an annotation icon in a 50-point frame, so the picture holds a small dot amid transparency.
  const dot = useImage(
    useColorScheme() === 'dark' ? require('@/assets/images/trail-dot-dark.png') : require('@/assets/images/trail-dot.png'),
  );
  // The camera fits the Trail once. Later readings must not undo the Adventurer's zoom and pan.
  const [cameraPosition] = useState(() => {
    const camera = fitCamera(last ? [...trail, last] : trail);
    return camera && { coordinates: camera.center, zoom: camera.zoom };
  });

  if (Platform.OS !== 'ios' || !cameraPosition) return null;

  const coordinates = trail.map(at);
  return (
    <AppleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      uiSettings={{ myLocationButtonEnabled: false, scaleBarEnabled: true, togglePitchEnabled: false }}
      // expo-maps keeps map places selectable even with selectionEnabled off, so the map shows none.
      properties={{ selectionEnabled: false, pointsOfInterest: { including: [] } }}
      polylines={coordinates.length > 1 ? [{ id: 'trail', coordinates, color: theme.accent, width: 4 }] : []}
      circles={
        last?.accuracyM
          ? [{ id: 'accuracy', center: at(last), radius: last.accuracyM, color: translucent(theme.accent, 0.15), lineColor: theme.accent, lineWidth: 1 }]
          : []
      }
      annotations={dot ? coordinates.map((c, i) => ({ id: `reading-${i}`, coordinates: c, icon: dot })) : []}
      markers={last ? [{ id: 'last', coordinates: at(last), tintColor: theme.text, title: t.adventure.lastKnown(t.when(last.takenAt)) }] : []}
    />
  );
}

const styles = StyleSheet.create({
  map: { height: 320, width: '100%', borderRadius: 12, overflow: 'hidden' },
});
