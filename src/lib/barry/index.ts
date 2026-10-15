import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { notificationText } from '@/lib/wording';

import type { NotificationService } from './alarms';
import { createBarry } from './client';
import { type LocationService, TRAIL_FENCE_TASK, TRAIL_LOCATION_TASK } from './trail';
import type { Position } from './types';

export type * from './types';
export type { Alarm } from './alarms';
export { startWarnings } from './warnings';

const POSITION_TIMEOUT_MS = 5_000;

const toPosition = (reading: Location.LocationObject): Position => ({
  takenAt: new Date(reading.timestamp),
  latitude: reading.coords.latitude,
  longitude: reading.coords.longitude,
  accuracyM: reading.coords.accuracy,
});

const currentPosition = async (): Promise<Position | null> => {
  const reading = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
  ]);
  return reading ? toPosition(reading) : null;
};

const readPosition = async (): Promise<Position | null> => {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    return await currentPosition();
  } catch {
    return null;
  }
};

const UPDATE_OPTIONS = {
  recording: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 10,
    deferredUpdatesInterval: 60_000,
    deferredUpdatesDistance: 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
  },
  delivering: {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 0,
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  },
} satisfies Record<Parameters<LocationService['startUpdates']>[0], Location.LocationTaskOptions>;

const location: LocationService = {
  backgroundPermitted: async () => (await Location.getBackgroundPermissionsAsync()).granted,
  requestBackground: async () => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return false;
    return (await Location.requestBackgroundPermissionsAsync()).granted;
  },
  // On a running task iOS only reapplies the options, which is how the mode switches.
  startUpdates: (mode) => Location.startLocationUpdatesAsync(TRAIL_LOCATION_TASK, UPDATE_OPTIONS[mode]),
  stopUpdates: async () => {
    if (await Location.hasStartedLocationUpdatesAsync(TRAIL_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRAIL_LOCATION_TASK);
    }
  },
  setFence: async (center) => {
    if (center) {
      await Location.startGeofencingAsync(TRAIL_FENCE_TASK, [
        {
          identifier: 'trail',
          latitude: center.latitude,
          longitude: center.longitude,
          radius: 200,
          notifyOnEnter: false,
          notifyOnExit: true,
        },
      ]);
    } else if (await Location.hasStartedGeofencingAsync(TRAIL_FENCE_TASK)) {
      await Location.stopGeofencingAsync(TRAIL_FENCE_TASK);
    }
  },
  lastReading: async () => {
    try {
      const current = await currentPosition();
      if (current) return current;
      const last = await Location.getLastKnownPositionAsync();
      return last ? toPosition(last) : null;
    } catch {
      return null;
    }
  },
};

const notifications: NotificationService = {
  scheduledIdentifiers: async () => (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier),
  schedule: async (alarm) => {
    await Notifications.scheduleNotificationAsync({
      identifier: alarm.identifier,
      content: notificationText(alarm),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alarm.at },
    });
  },
  cancel: (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
};

export const barry = createBarry({
  supabase,
  readPosition,
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  now: () => new Date(),
  storage,
  notificationsPermitted: async () => (await Notifications.getPermissionsAsync()).granted,
  notifications,
  location,
});
