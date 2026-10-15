import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { barry } from '@/lib/barry';

import { TRAIL_FENCE_TASK, TRAIL_LOCATION_TASK } from './trail';

TaskManager.defineTask<{ locations: LocationObject[] }>(TRAIL_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  await barry.trail.onLocations(data.locations);
});

TaskManager.defineTask(TRAIL_FENCE_TASK, async ({ error }) => {
  if (error) return;
  await barry.trail.onFenceExit();
});
