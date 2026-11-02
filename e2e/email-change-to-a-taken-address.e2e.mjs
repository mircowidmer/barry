import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/profile.md § Gotchas "A wrong current password shows Barry's own text in the footer; anything else Supabase refuses, such as a new password under ten characters or an address another account uses, shows Supabase's English message."
test('an address another account uses is refused with Supabase\'s English message, and the address stays as it was', async () => {
  const anna = await adventurer();
  const marco = await adventurer();

  const taken = await anna.client.auth.updateUser({ email: marco.email });
  assert.equal(taken.error?.code, 'email_exists', 'Supabase refuses the address of another account');
  assert.match(taken.error.message, /already been registered/, 'with its English message');

  const { user } = must(await admin.auth.admin.getUserById(anna.userId), 'Anna\'s account');
  assert.equal(user.email, anna.email, 'Anna keeps her address');
  assert.equal(user.new_email, undefined, 'no new address waits for its confirmation');
});
