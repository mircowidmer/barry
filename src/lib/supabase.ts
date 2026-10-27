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

// Expo inlines EXPO_PUBLIC_ variables only where they are read by their full name.
const required = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`${name} is not set; copy .env.example to .env.local`);
  return value;
};
const url = required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
const publishableKey = required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient(
  url,
  publishableKey,
  {
    global: { fetch: signedOnly(fetchWithTimeout, publishableKey) },
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
    supabase.auth.startAutoRefresh().catch(() => undefined);
  } else {
    supabase.auth.stopAutoRefresh().catch(() => undefined);
  }
});
