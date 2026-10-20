import type { SupabaseClient } from '@supabase/supabase-js';

type AuthClient = Pick<SupabaseClient['auth'], 'signInWithPassword' | 'updateUser' | 'refreshSession'>;

/** The signed-in Adventurer's addresses: the one that works, and the one waiting for its confirmations. */
export type AccountEmail = { email: string; pendingEmail: string | null };

export type ChangePasswordOutcome = { kind: 'changed' } | { kind: 'wrong_password' } | { kind: 'failed'; message: string };

export type ChangeEmailOutcome = { kind: 'confirmation_sent'; from: string; to: string } | { kind: 'failed'; message: string };

/**
 * Changes to the sign-in itself. The password change checks the current password by signing in
 * with it first. The email change asks Supabase for a new address, which sends a link to the
 * current address and one to the new one; the address changes once both links are opened.
 */
export const createAccount = (auth: AuthClient) => {
  const email = async (): Promise<AccountEmail> => {
    const { data, error } = await auth.refreshSession();
    if (error) throw error;
    if (!data.user?.email) throw new Error('No account is signed in.');
    return { email: data.user.email, pendingEmail: data.user.new_email ?? null };
  };

  const changePassword = async (email: string, currentPassword: string, newPassword: string): Promise<ChangePasswordOutcome> => {
    const check = await auth.signInWithPassword({ email, password: currentPassword });
    if (check.error) {
      return check.error.code === 'invalid_credentials' ? { kind: 'wrong_password' } : { kind: 'failed', message: check.error.message };
    }
    const { error } = await auth.updateUser({ password: newPassword });
    return error ? { kind: 'failed', message: error.message } : { kind: 'changed' };
  };

  const changeEmail = async (from: string, to: string): Promise<ChangeEmailOutcome> => {
    const { data, error } = await auth.updateUser({ email: to });
    if (error) return { kind: 'failed', message: error.message };
    return { kind: 'confirmation_sent', from, to: data.user.new_email ?? to };
  };

  return { email, changePassword, changeEmail };
};

export type Account = ReturnType<typeof createAccount>;
