import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type SupabaseStatus =
  | { state: 'checking' }
  | { state: 'connected' }
  | { state: 'error'; message: string };

export function useSupabaseStatus(): SupabaseStatus {
  const [status, setStatus] = useState<SupabaseStatus>({ state: 'checking' });

  useEffect(() => {
    supabase.storage.listBuckets().then(
      ({ error }) =>
        setStatus(error ? { state: 'error', message: error.message } : { state: 'connected' }),
      (e: unknown) => setStatus({ state: 'error', message: String(e) }),
    );
  }, []);

  return status;
}
