import { describe, expect, it } from '@jest/globals';

import { createPasswordReset, type PasswordResetAuth } from './password-reset';

const setup = ({ codeAccepted = true, passwordAccepted = true, mailSent = true } = {}) => {
  const calls: { method: string; args: unknown }[] = [];
  const auth = {
    resetPasswordForEmail: async (email: string, options?: unknown) => {
      calls.push({ method: 'resetPasswordForEmail', args: [email, options] });
      return mailSent ? { data: {}, error: null } : { data: null, error: { message: 'Email rate limit exceeded' } };
    },
    verifyOtp: async (params: unknown) => {
      calls.push({ method: 'verifyOtp', args: params });
      return codeAccepted
        ? { data: { user: { id: 'u1' }, session: { access_token: 'token' } }, error: null }
        : { data: { user: null, session: null }, error: { message: 'Token has expired or is invalid' } };
    },
    updateUser: async (attributes: unknown) => {
      calls.push({ method: 'updateUser', args: attributes });
      return passwordAccepted
        ? { data: { user: { id: 'u1' } }, error: null }
        : { data: { user: null }, error: { message: 'Password should be at least 6 characters.' } };
    },
    signOut: async () => {
      calls.push({ method: 'signOut', args: undefined });
      return { error: null };
    },
  } as unknown as PasswordResetAuth;
  return { reset: createPasswordReset(auth), calls };
};

describe('requestCode', () => {
  it('asks Supabase for a recovery email to the trimmed address', async () => {
    const { reset, calls } = setup();
    expect(await reset.requestCode('  anna@example.com ')).toEqual({ kind: 'sent' });
    expect(calls).toEqual([{ method: 'resetPasswordForEmail', args: ['anna@example.com', {}] }]);
  });

  it('passes the captcha token along when the build has one', async () => {
    const { reset, calls } = setup();
    await reset.requestCode('anna@example.com', 'turnstile-token');
    expect(calls).toEqual([{ method: 'resetPasswordForEmail', args: ['anna@example.com', { captchaToken: 'turnstile-token' }] }]);
  });

  it('reports why no email went out', async () => {
    const { reset } = setup({ mailSent: false });
    expect(await reset.requestCode('anna@example.com')).toEqual({ kind: 'failed', message: 'Email rate limit exceeded' });
  });
});

describe('setPassword', () => {
  it('verifies the code as a recovery code and then sets the new password', async () => {
    const { reset, calls } = setup();
    expect(await reset.setPassword({ email: 'anna@example.com', code: ' 123456 ', password: 'new-secret' })).toEqual({ kind: 'reset' });
    expect(calls).toEqual([
      { method: 'verifyOtp', args: { email: 'anna@example.com', token: '123456', type: 'recovery' } },
      { method: 'updateUser', args: { password: 'new-secret' } },
    ]);
  });

  it('keeps the old password when the code is wrong', async () => {
    const { reset, calls } = setup({ codeAccepted: false });
    expect(await reset.setPassword({ email: 'anna@example.com', code: '000000', password: 'new-secret' })).toEqual({
      kind: 'failed',
      message: 'Token has expired or is invalid',
    });
    expect(calls.map((c) => c.method)).toEqual(['verifyOtp']);
  });

  it('signs out again when the new password is refused, so the code alone does not sign the Adventurer in', async () => {
    const { reset, calls } = setup({ passwordAccepted: false });
    expect(await reset.setPassword({ email: 'anna@example.com', code: '123456', password: 'short' })).toEqual({
      kind: 'failed',
      message: 'Password should be at least 6 characters.',
    });
    expect(calls.map((c) => c.method)).toEqual(['verifyOtp', 'updateUser', 'signOut']);
  });
});
