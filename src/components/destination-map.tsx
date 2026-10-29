import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { AppleMaps } from 'expo-maps';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ARRIVAL_RADIUS_M, type Point } from '@/lib/barry';

export type MapCamera = { center: Point; zoom: number };

export type DestinationPreviewProps = { point: Point; adjust: string; onAdjust: () => void };

export type DestinationMapProps = { camera: MapCamera; onCenter: (point: Point) => void };

// Close enough that the circle the Arrival Notice fires in is easy to see.
const PREVIEW_ZOOM = 14.5;

// expo-maps keeps map places selectable even with selectionEnabled off, so the maps show none.
const quiet = { selectionEnabled: false, pointsOfInterest: { including: [] } };

/** The pinned destination with the circle Barry shows the Arrival Notice in. It only shows; Adjust moves it. */
export function DestinationPreview({ point, adjust, onAdjust }: DestinationPreviewProps) {
  const theme = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <View style={styles.preview}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <AppleMaps.View
          // A new key recentres the map on a moved pin; the camera prop only sets the first view.
          key={`${point.latitude},${point.longitude}`}
          style={StyleSheet.absoluteFill}
          cameraPosition={{ coordinates: point, zoom: PREVIEW_ZOOM }}
          uiSettings={{ compassEnabled: false, myLocationButtonEnabled: false, scaleBarEnabled: false, togglePitchEnabled: false }}
          properties={quiet}
          markers={[{ id: 'destination', coordinates: point, tintColor: theme.accent }]}
          circles={[
            { id: 'arrival', center: point, radius: ARRIVAL_RADIUS_M, color: `${theme.accent}29`, lineColor: theme.accent, lineWidth: 1.5 },
          ]}
        />
      </View>
      {/* The pressable reaches 5 points past the glass on every side, so the button takes a 44-point tap. */}
      <Pressable accessibilityRole="button" onPress={onAdjust} style={styles.adjustTarget}>
        <GlassView isInteractive style={[styles.adjust, !isLiquidGlassAvailable() && { backgroundColor: theme.background }]}>
          <ThemedText type="small">{adjust}</ThemedText>
        </GlassView>
      </Pressable>
    </View>
  );
}

/** A map the Adventurer moves under a pin that stays in the middle; it reports the point under the pin. */
export function DestinationMap({ camera, onCenter }: DestinationMapProps) {
  const map = useRef<AppleMaps.MapView>(null);
  const [cameraPosition] = useState({ coordinates: camera.center, zoom: camera.zoom });
  // A new camera, such as the phone's own position, moves the map. The first camera is the view's own,
  // because a move on mount reaches the native view before it exists.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    map.current?.setCameraPosition({ coordinates: camera.center, zoom: camera.zoom }).catch(() => undefined);
  }, [camera]);

  if (Platform.OS !== 'ios') return null;

  return (
    <AppleMaps.View
      ref={map}
      style={StyleSheet.absoluteFill}
      cameraPosition={cameraPosition}
      uiSettings={{ myLocationButtonEnabled: false, scaleBarEnabled: true, togglePitchEnabled: false }}
      properties={quiet}
      onCameraMove={({ coordinates: { latitude, longitude } }) => {
        if (latitude !== undefined && longitude !== undefined) onCenter({ latitude, longitude });
      }}
    />
  );
}

const styles = StyleSheet.create({
  preview: { height: 160, borderRadius: 18, overflow: 'hidden' },
  adjustTarget: { position: 'absolute', top: 5, right: 5, padding: 5 },
  adjust: { height: 34, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 17, overflow: 'hidden' },
});
