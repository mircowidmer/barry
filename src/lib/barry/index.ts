import { presentContactPickerAsync } from 'expo-contacts/legacy';
import { getLocales } from 'expo-localization';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import { storage } from '@/lib/storage';
import { fetchWithTimeout, supabase } from '@/lib/supabase';
import { appLanguage } from '@/lib/language';
import { arrivalText, notificationText } from '@/lib/wording';

import type { NotificationService } from './alarms';
import { createBarry } from './client';
import type { PhoneContact } from './phone-contact';
import { type LocationService, TRAIL_FENCE_TASK, TRAIL_LOCATION_TASK } from './trail';
import { SLOT_MS } from './trail-buffer';
import { searchPlaces } from '../../../modules/place-search';

import type { Place, Position } from './types';

export type * from './types';
export type { Alarm } from './alarms';
export type { AvalancheBulletin, ConditionsResult, DaylightView, ForecastView } from './conditions';
export { adventureDay, daylightView, forecastView, HOUR_MS } from './conditions';
export { isEmailAddress, isPhoneNumber, reachableAddresses } from './reach';
export { ARRIVAL_RADIUS_M } from './trail';
export { darkBefore, startWarnings } from './warnings';

const POSITION_TIMEOUT_MS = 5_000;

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
};

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

const findPlaces = async (query: string): Promise<Place[]> => {
  try {
    // A known position ranks the places near the Adventurer first; without one, the search still works.
    const near = await Location.getLastKnownPositionAsync().catch(() => null);
    const found = await searchPlaces(query, near && { latitude: near.coords.latitude, longitude: near.coords.longitude });
    return found.map(({ name, subtitle, latitude, longitude }) => ({ name, subtitle, point: { latitude, longitude } }));
  } catch {
    return [];
  }
};

// The legacy picker hands over the picked contact itself, so Barry never needs access to the phone's
// contacts. The class API returns only an id, and reading it asks for full access.
const pickContact = async (): Promise<PhoneContact | null> => {
  const contact = await presentContactPickerAsync();
  if (!contact) return null;
  // The picker's copy carries the name parts but not always the formatted full name.
  const parts = [contact.firstName, contact.middleName, contact.lastName].filter((part) => part?.trim());
  return {
    fullName: contact.name?.trim() || parts.join(' '),
    company: contact.company ?? null,
    phones: (contact.phoneNumbers ?? []).map((p) => ({ label: p.label, number: p.number, region: p.countryCode })),
    emails: (contact.emails ?? []).map((e) => ({ label: e.label, address: e.email })),
  };
};

const UPDATE_OPTIONS = {
  recording: {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 10,
    deferredUpdatesInterval: SLOT_MS,
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
  setFences: async (fences) => {
    if (fences.length > 0) {
      await Location.startGeofencingAsync(
        TRAIL_FENCE_TASK,
        fences.map(({ identifier, center, radiusM, notifyOn }) => ({
          identifier,
          latitude: center.latitude,
          longitude: center.longitude,
          radius: radiusM,
          notifyOnEnter: notifyOn === 'enter',
          notifyOnExit: notifyOn === 'exit',
        })),
      );
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
  showArrival: async (adventure) => {
    await Notifications.scheduleNotificationAsync({
      identifier: `barry.arrival.${adventure.id}`,
      content: arrivalText(adventure),
      trigger: null,
    });
  },
};

export const barry = createBarry({
  supabase,
  readPosition,
  findPlaces,
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: appLanguage,
  now: () => new Date(),
  pickContact,
  region: () => getLocales()[0].regionCode ?? null,
  storage,
  notificationsPermitted: async () => (await Notifications.getPermissionsAsync()).granted,
  notifications,
  location,
  fetchJson,
});
