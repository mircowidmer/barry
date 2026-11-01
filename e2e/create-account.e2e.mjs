import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

import { API, admin, must, signIn } from './stack.mjs';

const PUBLISHABLE_KEY = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' }).match(/^PUBLISHABLE_KEY="(.*)"$/m)[1];
const CURRENT_TERMS = readFileSync('src/lib/site.ts', 'utf8').match(/CURRENT_TERMS = '([^']+)'/)[1];

// .claude/skills/barry-frontend-verify/features/sign-in.md § Sub-features "`signin-create` creates an account with email and password."
// docs/spec.md § Accounts "Creating an account records the version of the Terms of Use it accepted."
test('Create Account creates an account with email and password, which records the Terms of Use it accepted', async () => {
  const email = `new-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  let userId;
  after(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  // As src/lib/sign-in.ts does it, on a phone where nobody is signed in.
  const phone = createClient(API, PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { user } = must(
    await phone.auth.signUp({ email, password, options: { data: { terms_version: CURRENT_TERMS } } }),
    'create the account',
  );
  userId = user.id;

  const { user: stored } = must(await admin.auth.admin.getUserById(userId), 'the new account');
  assert.equal(stored.email, email, 'the account has the address it was created with');
  assert.equal(stored.user_metadata.terms_version, CURRENT_TERMS, 'the account records the Terms of Use it accepted');

  const { session } = must(await signIn(email, password), 'sign in to the new account');
  assert.equal(session.user.id, userId, 'the address and the password sign in to the new account');
});
