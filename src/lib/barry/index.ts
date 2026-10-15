import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { supabase } from '@/lib/supabase';

import { createBarry } from './client';
import type { Position } from './types';

export type * from './types';
export { startWarnings } from './warnings';

const POSITION_TIMEOUT_MS = 5_000;

const readPosition = async (): Promise<Position | null> => {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const reading = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
    ]);
    if (!reading) return null;
    return {
      takenAt: new Date(reading.timestamp),
      latitude: reading.coords.latitude,
      longitude: reading.coords.longitude,
      accuracyM: reading.coords.accuracy,
    };
  } catch {
    return null;
  }
};

export const barry = createBarry({
  supabase,
  readPosition,
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  now: () => new Date(),
  storage: localStorage,
  pushPermitted: async () => (await Notifications.getPermissionsAsync()).granted,
});
