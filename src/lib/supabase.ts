import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { signedOnly } from '@/lib/signed-fetch';
import { storage } from '@/lib/storage';

const REQUEST_TIMEOUT_MS = 10_000;

// A weak signal can leave a request hanging far longer than this. Failing it lets the app fall
// back to the saved Adventure and keep the Check-in reachable.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  if (init?.signal?.aborted) abort();
  init?.signal?.addEventListener('abort', abort);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  });
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    global: { fetch: signedOnly(fetchWithTimeout, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!) },
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
