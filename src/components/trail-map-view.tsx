import { useImage } from 'expo-image';
import { AppleMaps, type CameraMoveEvent } from 'expo-maps';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { fitCamera, type Region, regionOf, shows } from '@/lib/trail-map/camera';
import type { LastKnown, TrailPoint } from '@/lib/trail-map/types';
import { useTexts } from '@/lib/texts';

export type TrailMapViewProps = { trail: TrailPoint[]; last: LastKnown | null };

const at = (p: TrailPoint) => ({ latitude: p.latitude, longitude: p.longitude });

const translucent = (hex: string, alpha: number) => {
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `rgba(${channel(1)},${channel(3)},${channel(5)},${alpha})`;
};

export function TrailMapView({ trail, last }: TrailMapViewProps) {
  const theme = useTheme();
  const t = useTexts();
  // expo-maps draws an annotation icon in a 50-point frame, so the picture holds a small dot amid transparency.
  const dot = useImage(
    useColorScheme() === 'dark' ? require('@/assets/images/trail-dot-dark.png') : require('@/assets/images/trail-dot.png'),
  );
  const map = useRef<AppleMaps.MapView>(null);
  // The camera fits the Trail again only once the newest reading leaves the region on screen, so the
  // Adventurer's zoom and pan survive every reading they can still see.
  const [fitted] = useState(() => fitCamera(last ? [...trail, last] : trail));
  const [cameraPosition] = useState(() => fitted && { coordinates: fitted.center, zoom: fitted.zoom });
  const visible = useRef<Region | null>(fitted && regionOf(fitted));
  const newest = last ?? trail.at(-1);
  useEffect(() => {
    if (!newest || (visible.current && shows(visible.current, newest))) return;
    const camera = fitCamera(last ? [...trail, last] : trail);
    if (!camera) return;
    visible.current = regionOf(camera);
    // A map removed while the move is on its way is nothing to move.
    map.current?.setCameraPosition({ coordinates: camera.center, zoom: camera.zoom }).catch(() => undefined);
  }, [trail, last, newest]);
  const onCameraMove = ({ coordinates, latitudeDelta, longitudeDelta }: CameraMoveEvent) => {
    if (coordinates.latitude === undefined || coordinates.longitude === undefined) return;
    visible.current = { center: { latitude: coordinates.latitude, longitude: coordinates.longitude }, latitudeDelta, longitudeDelta };
  };

  if (Platform.OS !== 'ios' || !cameraPosition) return null;

  const coordinates = trail.map(at);
  return (
    <AppleMaps.View
      ref={map}
      onCameraMove={onCameraMove}
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
