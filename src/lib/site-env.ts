// The Supabase project the web pages talk to. Expo inlines EXPO_PUBLIC_ variables only where they are read by
// their full name.
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
