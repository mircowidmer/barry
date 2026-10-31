import { type LocationObject, type LocationRegion, LocationGeofencingEventType } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { barry } from '@/lib/barry';

import { TRAIL_FENCE_TASK, TRAIL_LOCATION_TASK } from './trail';

TaskManager.defineTask<{ locations: LocationObject[] }>(TRAIL_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  await Promise.all([barry.trail.onLocations(data.locations), barry.noticeDeliveryFailures().catch(() => undefined)]);
});

TaskManager.defineTask<{ eventType: LocationGeofencingEventType; region: LocationRegion }>(TRAIL_FENCE_TASK, async ({ data, error }) => {
  if (error) return;
  await Promise.all([
    barry.trail.onFenceEvent({
      region: data.region.identifier ?? '',
      entered: data.eventType === LocationGeofencingEventType.Enter,
    }),
    barry.noticeDeliveryFailures().catch(() => undefined),
  ]);
});
