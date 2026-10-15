import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { fetchTrailMap, tokenFromHash } from './fetch';
import type { TrailMap, TrailMapView } from './types';

const POLL_MS = 60_000;

const onWeb = Platform.OS === 'web';

const load = fetchTrailMap(
  (input, init) => fetch(input, init),
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
);

export function useTrailMap(): TrailMapView {
  const [view, setView] = useState<TrailMapView>(onWeb ? { kind: 'loading' } : { kind: 'not_found' });

  useEffect(() => {
    if (!onWeb) return;
    const token = tokenFromHash(window.location.hash);
    let last: TrailMap | null = null;
    let since: Date | null = null;
    let stopped = false;
    const poll = async () => {
      const result = token ? await load(token) : null;
      if (stopped) return;
      if (result === 'offline') {
        since ??= new Date();
        setView({ kind: 'offline', since, last });
        return;
      }
      since = null;
      last = result;
      setView(result ? { kind: 'ready', map: result } : { kind: 'not_found' });
    };
    const reload = () => window.location.reload();
    window.addEventListener('hashchange', reload);
    poll();
    const timer = token ? setInterval(poll, POLL_MS) : undefined;
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('hashchange', reload);
    };
  }, []);

  return view;
}
