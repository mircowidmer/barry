import type { SupabaseClient, User } from '@supabase/supabase-js';

import { CURRENT_TERMS } from '@/lib/site';

/** The Auth user metadata key that holds the version of the Terms of Use the Adventurer accepted or was told about. */
export const TERMS_KEY = 'terms_version';

/** The day of `CURRENT_TERMS`, at local midnight. */
export const termsDay = (): Date => {
  // A date and time without an offset is local time.
  return new Date(`${CURRENT_TERMS}T00:00`);
};

/** An account from before Barry recorded the version has none, so it is told once too. */
export const termsOutdated = (user: Pick<User, 'user_metadata'>): boolean => {
  const seen: unknown = user.user_metadata?.[TERMS_KEY];
  return typeof seen !== 'string' || seen < CURRENT_TERMS;
};

export const recordTermsSeen = async (auth: Pick<SupabaseClient['auth'], 'updateUser'>): Promise<boolean> => {
  const { error } = await auth.updateUser({ data: { [TERMS_KEY]: CURRENT_TERMS } });
  return !error;
};
