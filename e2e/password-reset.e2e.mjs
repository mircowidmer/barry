import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { adventurer, must, waitForMail } from './stack.mjs';

test('an Adventurer who forgot the password sets a new one with the code from the recovery email', async () => {
  const anna = await adventurer();
  const { client, email, password: forgotten } = anna;
  must(await client.auth.signOut(), 'sign out, as a locked-out Adventurer is');

  must(await client.auth.resetPasswordForEmail(email), 'ask for the code');
  const mail = await waitForMail(email, 'Reset your password for Barry');
  const code = mail.Text.match(/\b\d{6}\b/)?.[0];
  assert.ok(code, 'the recovery email carries a six-digit code');
  assert.doesNotMatch(mail.Text, /https?:\/\//, 'the recovery email carries no link');

  const { session } = must(await client.auth.verifyOtp({ email, token: code, type: 'recovery' }), 'verify the code');
  assert.ok(session, 'the code signs the Adventurer in');
  const password = randomUUID();
  must(await client.auth.updateUser({ password }), 'set the new password');
  must(await client.auth.signOut(), 'sign out');

  const old = await client.auth.signInWithPassword({ email, password: forgotten });
  assert.ok(old.error, 'the forgotten password is refused');
  const { session: fresh } = must(await client.auth.signInWithPassword({ email, password }), 'sign in with the new password');
  assert.equal(fresh.user.id, anna.userId, 'the new password opens the same account');
});
