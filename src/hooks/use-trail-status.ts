import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { barry, type TrailStatus } from '@/lib/barry';

export function useTrailStatus(queuedAt: Date | null): TrailStatus | null {
  const [status, setStatus] = useState<TrailStatus | null>(null);
  const queuedMs = queuedAt?.getTime();
  const read = useCallback(() => {
    barry.trail.status().then(setStatus, () => undefined);
  }, []);
  useFocusEffect(read);
  useEffect(read, [read, queuedMs]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && read());
    return () => subscription.remove();
  }, [read]);
  return status;
}
