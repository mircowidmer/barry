import { describe, expect, it } from '@jest/globals';
import { AuthApiError } from '@supabase/supabase-js';

import { createAccount } from './account';

const setup = () => {
  const world = { password: 'old-password', email: 'anna@example.com', newEmail: null as string | null, signal: true };
  const calls: string[] = [];
  const offline = () => ({ data: { user: null, session: null }, error: new AuthApiError('Network request failed', 0, undefined) });
  const user = () => ({ id: 'u1', email: world.email, new_email: world.newEmail ?? undefined });
  const auth = {
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      calls.push(`sign in ${email}`);
      if (!world.signal) return offline();
      if (email !== world.email || password !== world.password) {
        return { data: { user: null, session: null }, error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') };
      }
      return { data: { user: user(), session: {} }, error: null };
    },
    updateUser: async (attributes: { password?: string; email?: string }) => {
      calls.push(`update ${Object.keys(attributes).join(',')}`);
      if (!world.signal) return offline();
      if (attributes.password === world.password) {
        return { data: { user: null }, error: new AuthApiError('New password should be different from the old password.', 422, 'same_password') };
      }
      if (attributes.password) world.password = attributes.password;
      if (attributes.email) world.newEmail = attributes.email;
      return { data: { user: user() }, error: null };
    },
    refreshSession: async () => {
      calls.push('refresh');
      if (!world.signal) return offline();
      return { data: { user: user(), session: {} }, error: null };
    },
  };
  return { account: createAccount(auth as unknown as Parameters<typeof createAccount>[0]), world, calls };
};

describe('changePassword', () => {
  it('changes the password once the current one checks out', async () => {
    const { account, world, calls } = setup();
    expect(await account.changePassword('anna@example.com', 'old-password', 'new-password')).toEqual({ kind: 'changed' });
    expect(world.password).toBe('new-password');
    expect(calls).toEqual(['sign in anna@example.com', 'update password']);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    const { account, world, calls } = setup();
    expect(await account.changePassword('anna@example.com', 'guess', 'new-password')).toEqual({ kind: 'wrong_password' });
    expect(world.password).toBe('old-password');
    expect(calls).toEqual(['sign in anna@example.com']);
  });

  it('passes on what Supabase refuses about the new password', async () => {
    const { account, world } = setup();
    expect(await account.changePassword('anna@example.com', 'old-password', 'old-password')).toEqual({
      kind: 'failed',
      message: 'New password should be different from the old password.',
    });
    expect(world.password).toBe('old-password');
  });

  it('fails without signal instead of calling the password wrong', async () => {
    const { account, world } = setup();
    world.signal = false;
    expect(await account.changePassword('anna@example.com', 'old-password', 'new-password')).toEqual({
      kind: 'failed',
      message: 'Network request failed',
    });
  });
});

describe('changeEmail', () => {
  it('asks for the new address and names both addresses that get a link', async () => {
    const { account, world } = setup();
    expect(await account.changeEmail('anna@example.com', 'anna.new@example.com')).toEqual({
      kind: 'confirmation_sent',
      from: 'anna@example.com',
      to: 'anna.new@example.com',
    });
    expect(world.email).toBe('anna@example.com');
    expect(world.newEmail).toBe('anna.new@example.com');
  });

  it('fails without signal', async () => {
    const { account, world } = setup();
    world.signal = false;
    expect(await account.changeEmail('anna@example.com', 'anna.new@example.com')).toEqual({ kind: 'failed', message: 'Network request failed' });
    expect(world.newEmail).toBeNull();
  });
});

describe('email', () => {
  it('reads the address that works and the one still waiting for its confirmations', async () => {
    const { account } = setup();
    expect(await account.email()).toEqual({ email: 'anna@example.com', pendingEmail: null });
    await account.changeEmail('anna@example.com', 'anna.new@example.com');
    expect(await account.email()).toEqual({ email: 'anna@example.com', pendingEmail: 'anna.new@example.com' });
  });

  it('throws without signal, so the screen shows the failure', async () => {
    const { account, world } = setup();
    world.signal = false;
    await expect(account.email()).rejects.toThrow('Network request failed');
  });
});
