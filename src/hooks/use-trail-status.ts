import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { barry, type TrailStatus } from '@/lib/barry';

export function useTrailStatus(queuedAt: Date | null): TrailStatus | null {
  const [status, setStatus] = useState<TrailStatus | null>(null);
  const queuedMs = queuedAt?.getTime();
  // Only the newest request lands, so a slow older answer cannot overwrite a newer status.
  const requests = useRef(0);
  const read = useCallback(() => {
    const request = ++requests.current;
    barry.trail.status().then(
      (next) => request === requests.current && setStatus(next),
      () => undefined,
    );
  }, []);
  useFocusEffect(read);
  useEffect(read, [read, queuedMs]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && read());
    return () => subscription.remove();
  }, [read]);
  return status;
}
