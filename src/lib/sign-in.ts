import type { SupabaseClient } from '@supabase/supabase-js';

import { CURRENT_TERMS } from '@/lib/site';
import { TERMS_KEY } from '@/lib/terms';
import { captchaOptions } from '@/lib/turnstile';

/**
 * Seconds Supabase Auth makes one address wait between two confirmation emails. Mirrors `max_frequency` in
 * `[remotes.hosted.auth.email]` of supabase/config.toml, which a test pins.
 */
export const RESEND_AFTER_SECONDS = 60;

export type Credentials = { email: string; password: string };

/** `unconfirmed`: the address has an account but its confirmation link is not opened yet. */
export type SignInOutcome = { kind: 'signed_in' } | { kind: 'unconfirmed' } | { kind: 'failed'; message: string };
export type ResendOutcome = { kind: 'sent' } | { kind: 'failed'; message: string };

export type SignInAuth = Pick<SupabaseClient['auth'], 'signInWithPassword' | 'signUp' | 'resend'>;

/**
 * Signing in and creating an account. A new account waits for its confirmation link before it can sign in, and records
 * the Terms of Use it accepted.
 */
export const createSignIn = (auth: SignInAuth) => ({
  signIn: async ({ email, password }: Credentials, captchaToken?: string): Promise<SignInOutcome> => {
    const { error } = await auth.signInWithPassword({ email: email.trim(), password, options: captchaOptions(captchaToken) });
    if (!error) return { kind: 'signed_in' };
    return error.code === 'email_not_confirmed' ? { kind: 'unconfirmed' } : { kind: 'failed', message: error.message };
  },

  signUp: async ({ email, password }: Credentials, captchaToken?: string): Promise<SignInOutcome> => {
    const { data, error } = await auth.signUp({
      email: email.trim(),
      password,
      options: { ...captchaOptions(captchaToken), data: { [TERMS_KEY]: CURRENT_TERMS } },
    });
    if (error) return { kind: 'failed', message: error.message };
    return data.session ? { kind: 'signed_in' } : { kind: 'unconfirmed' };
  },

  resend: async (email: string, captchaToken?: string): Promise<ResendOutcome> => {
    const { error } = await auth.resend({ type: 'signup', email: email.trim(), options: captchaOptions(captchaToken) });
    return error ? { kind: 'failed', message: error.message } : { kind: 'sent' };
  },
});
