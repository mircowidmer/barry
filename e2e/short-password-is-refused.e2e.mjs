import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must, signIn } from './stack.mjs';

// docs/hosted-supabase.md § Password rules "`minimum_password_length` in `[auth]` of `supabase/config.toml` asks for at least ten characters, on the hosted project and the local stack alike, so a guessed password of an Adventurer whose email a contact knows is no longer a short list."
// docs/hosted-supabase.md § Password rules "It asks for no particular kinds of characters, because length makes a password strong and such rules mostly push people to predictable patterns, so a long passphrase is welcome."
test('a new password needs at least ten characters and no particular kinds of characters', async () => {
  const anna = await adventurer();
  const { client, email, password } = anna;

  // The Account screen checks the current password by signing in with it before it changes anything.
  must(await client.auth.signInWithPassword({ email, password }), 'check the current password');
  const short = await client.auth.updateUser({ password: 'abcdefghi' });
  assert.equal(short.error?.code, 'weak_password', 'a password of nine characters is refused');
  assert.equal((await signIn(email, password)).error, null, 'the old password still signs in');
  assert.equal((await signIn(email, 'abcdefghi')).error?.code, 'invalid_credentials', 'the short password does not sign in');

  must(await client.auth.signInWithPassword({ email, password }), 'check the current password again');
  must(await client.auth.updateUser({ password: 'abcdefghij' }), 'ten lowercase letters, without digits or symbols');
  assert.equal((await signIn(email, 'abcdefghij')).error, null, 'the password of ten lowercase letters signs in');
  assert.equal((await signIn(email, password)).error?.code, 'invalid_credentials', 'the old password is refused');
});
