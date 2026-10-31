import type { SupabaseClient } from '@supabase/supabase-js';

import { captchaOptions } from '@/lib/turnstile';

type RequestCodeOutcome = { kind: 'sent' } | { kind: 'failed'; message: string };
type SetPasswordOutcome = { kind: 'reset' } | { kind: 'failed'; message: string };

export type PasswordResetAuth = Pick<SupabaseClient['auth'], 'resetPasswordForEmail' | 'verifyOtp' | 'updateUser' | 'signOut'>;

/** The recovery flow: a code by email, then the code and the new password together. The code signs the Adventurer in. */
export const createPasswordReset = (auth: PasswordResetAuth) => ({
  requestCode: async (email: string, captchaToken?: string): Promise<RequestCodeOutcome> => {
    const { error } = await auth.resetPasswordForEmail(email.trim(), captchaOptions(captchaToken));
    return error ? { kind: 'failed', message: error.message } : { kind: 'sent' };
  },

  setPassword: async ({ email, code, password }: { email: string; code: string; password: string }): Promise<SetPasswordOutcome> => {
    const verified = await auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (verified.error) return { kind: 'failed', message: verified.error.message };
    const updated = await auth.updateUser({ password });
    if (updated.error) {
      // The code already signed the Adventurer in. Without the new password that session would leave them on the tabs with a password they forgot.
      await auth.signOut().catch(() => undefined);
      return { kind: 'failed', message: updated.error.message };
    }
    return { kind: 'reset' };
  },
});
