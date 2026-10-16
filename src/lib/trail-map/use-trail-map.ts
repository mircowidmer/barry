import { useEffect, useState } from 'react';

import { fetchTrailMap, mergeTrailMap, newestReading, tokenFromHash } from './fetch';
import type { TrailMap, TrailMapState } from './types';

const POLL_MS = 60_000;

const load = fetchTrailMap(
  (input, init) => fetch(input, init),
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
);

export function useTrailMap(): TrailMapState {
  const [view, setView] = useState<TrailMapState>({ kind: 'loading' });

  useEffect(() => {
    const token = tokenFromHash(window.location.hash);
    let last: TrailMap | null = null;
    let since: Date | null = null;
    let stopped = false;
    const poll = async () => {
      const result = token ? await load(token, newestReading(last)) : null;
      if (stopped) return;
      if (result === 'offline') {
        since ??= new Date();
        setView({ kind: 'offline', since, last });
        return;
      }
      since = null;
      last = result ? mergeTrailMap(last, result) : null;
      setView(last ? { kind: 'ready', map: last } : { kind: 'not_found' });
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
