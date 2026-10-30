import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSignIn, RESEND_AFTER_SECONDS, type SignInAuth } from './sign-in';

type Failure = { message: string; code?: string };

const setup = ({ signInError = null as Failure | null, signUpSession = false, signUpError = null as Failure | null, resendError = null as Failure | null } = {}) => {
  const calls: { method: string; args: unknown }[] = [];
  const auth = {
    signInWithPassword: async (args: unknown) => {
      calls.push({ method: 'signInWithPassword', args });
      return { data: {}, error: signInError };
    },
    signUp: async (args: unknown) => {
      calls.push({ method: 'signUp', args });
      return { data: { session: signUpSession ? { access_token: 'token' } : null }, error: signUpError };
    },
    resend: async (args: unknown) => {
      calls.push({ method: 'resend', args });
      return { data: {}, error: resendError };
    },
  } as unknown as SignInAuth;
  return { signIn: createSignIn(auth), calls };
};

const anna = { email: ' anna@example.com ', password: 'secret' };

describe('signIn', () => {
  it('signs in with the trimmed address and the captcha token', async () => {
    const { signIn, calls } = setup();
    expect(await signIn.signIn(anna, 'turnstile-token')).toEqual({ kind: 'signed_in' });
    expect(calls).toEqual([
      { method: 'signInWithPassword', args: { email: 'anna@example.com', password: 'secret', options: { captchaToken: 'turnstile-token' } } },
    ]);
  });

  it('tells an unconfirmed address apart from a refusal', async () => {
    expect(await setup({ signInError: { message: 'Email not confirmed', code: 'email_not_confirmed' } }).signIn.signIn(anna)).toEqual({ kind: 'unconfirmed' });
    expect(await setup({ signInError: { message: 'Invalid login credentials', code: 'invalid_credentials' } }).signIn.signIn(anna)).toEqual({
      kind: 'failed',
      message: 'Invalid login credentials',
    });
  });
});

describe('signUp', () => {
  it('waits for the confirmation link when Supabase hands out no session', async () => {
    const { signIn, calls } = setup();
    expect(await signIn.signUp(anna)).toEqual({ kind: 'unconfirmed' });
    expect(calls).toEqual([{ method: 'signUp', args: { email: 'anna@example.com', password: 'secret', options: {} } }]);
  });

  it('is signed in at once where the stack confirms no addresses', async () => {
    expect(await setup({ signUpSession: true }).signIn.signUp(anna)).toEqual({ kind: 'signed_in' });
  });

  it('reports why the account was not created', async () => {
    expect(await setup({ signUpError: { message: 'Password should be at least 10 characters.' } }).signIn.signUp(anna)).toEqual({
      kind: 'failed',
      message: 'Password should be at least 10 characters.',
    });
  });
});

describe('resend', () => {
  it('sends the confirmation email for the sign-up again', async () => {
    const { signIn, calls } = setup();
    expect(await signIn.resend(' anna@example.com', 'turnstile-token')).toEqual({ kind: 'sent' });
    expect(calls).toEqual([{ method: 'resend', args: { type: 'signup', email: 'anna@example.com', options: { captchaToken: 'turnstile-token' } } }]);
  });

  it('reports why no email went out', async () => {
    const message = 'For security purposes, you can only request this after 54 seconds.';
    expect(await setup({ resendError: { message } }).signIn.resend('anna@example.com')).toEqual({ kind: 'failed', message });
  });
});

describe('RESEND_AFTER_SECONDS', () => {
  it('matches the hosted Auth limit on confirmation emails', () => {
    const config = readFileSync(join(__dirname, '../../supabase/config.toml'), 'utf8');
    const section = config.split('[remotes.hosted.auth.email]')[1]?.split(/^\[/m)[0] ?? '';
    expect(section).toContain('max_frequency = "1m0s"');
    expect(RESEND_AFTER_SECONDS).toBe(60);
  });
});
