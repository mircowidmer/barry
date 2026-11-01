import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, mailCount, must, poll, sleep, waitForMail } from './stack.mjs';

const SUBJECT = 'Reset your password for Barry';

const codeIn = (mail) => {
  const code = mail.Text.match(/\b\d{8}\b/)?.[0];
  assert.ok(code, 'the recovery email carries an eight-digit code');
  return code;
};

// .claude/skills/barry-frontend-verify/features/sign-in.md § Gotchas "A wrong or expired code fails with a Supabase error under `New Password`."
// .claude/skills/barry-frontend-verify/features/sign-in.md § Gotchas "`Send Again` sends a new code, and the old one stops working."
test('a wrong code fails, and Send Again sends a new code after which the old one stops working', async () => {
  const anna = await adventurer();
  const { client, email } = anna;
  must(await client.auth.signOut(), 'sign out, as a locked-out Adventurer is');

  must(await client.auth.resetPasswordForEmail(email), 'ask for the code');
  const first = codeIn(await waitForMail(email, SUBJECT));

  const wrongCode = String((Number(first) + 1) % 1e8).padStart(8, '0');
  const wrong = await client.auth.verifyOtp({ email, token: wrongCode, type: 'recovery' });
  assert.equal(wrong.error?.code, 'otp_expired', 'a wrong code fails with a Supabase error');
  assert.equal(wrong.data.session, null, 'a wrong code signs nobody in');

  // Auth lets one address ask again after max_frequency, a second locally.
  await sleep(2);
  must(await client.auth.resetPasswordForEmail(email), 'send the code again');
  await poll('second recovery email', async () => (await mailCount(email, SUBJECT)) >= 2);
  const second = codeIn(await waitForMail(email, SUBJECT));
  assert.notEqual(second, first, 'Send Again sends a new code');

  const old = await client.auth.verifyOtp({ email, token: first, type: 'recovery' });
  assert.equal(old.error?.code, 'otp_expired', 'the old code fails with a Supabase error');
  assert.equal(old.data.session, null, 'the old code signs nobody in');

  const { session } = must(await client.auth.verifyOtp({ email, token: second, type: 'recovery' }), 'verify the new code');
  assert.equal(session?.user.id, anna.userId, 'the new code signs the Adventurer in');
});
