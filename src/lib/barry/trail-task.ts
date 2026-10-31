import { type LocationObject, type LocationRegion, LocationGeofencingEventType } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { barry } from '@/lib/barry';

import { TRAIL_FENCE_TASK, TRAIL_LOCATION_TASK } from './trail';

TaskManager.defineTask<{ locations: LocationObject[] }>(TRAIL_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  await barry.trail.onLocations(data.locations);
  await barry.noticeDeliveryFailures().catch(() => undefined);
});

TaskManager.defineTask<{ eventType: LocationGeofencingEventType; region: LocationRegion }>(TRAIL_FENCE_TASK, async ({ data, error }) => {
  if (error) return;
  await barry.trail.onFenceEvent({
    region: data.region.identifier ?? '',
    entered: data.eventType === LocationGeofencingEventType.Enter,
  });
  await barry.noticeDeliveryFailures().catch(() => undefined);
});
