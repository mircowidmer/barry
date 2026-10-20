import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { admin, adventurer, must, signIn, waitForMail } from './stack.mjs';

const CONFIRM_EMAIL_CHANGE = 'Confirm your new email address';

// Auth asks for both links only where accounts confirm their address by email. Locally
// enable_confirmations is off, so Auth confirms the change with the first link it gets.
const authEmail = readFileSync('supabase/config.toml', 'utf8').split('[auth.email]')[1].split('\n[')[0];
const BOTH_LINKS_NEEDED = /^enable_confirmations = true/m.test(authEmail);

/** The verify link in one of Supabase's confirmation emails, as Mailpit stored it. */
const confirmationLink = (mail) => {
  const href = mail.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1] ?? mail.Text.match(/https?:\/\/\S*\/auth\/v1\/verify\S*/)?.[0];
  assert.ok(href, `a verify link in the email to ${mail.To.map((to) => to.Address).join(', ')}`);
  return href.replaceAll('&amp;', '&');
};

/** Opens a confirmation link the way a browser does, and returns where Supabase sends it on. */
const follow = async (link) => {
  const response = await fetch(link, { redirect: 'manual' });
  assert.equal(response.status, 303, `the confirmation link answers with a redirect, not ${response.status}`);
  return response.headers.get('location');
};

const storedEmail = async (userId) => {
  const { data } = await admin.auth.admin.getUserById(userId);
  return { email: data.user.email, pending: data.user.new_email };
};

test('the Adventurer changes the password after the current one is checked, and the email address once the links Barry sent are opened', async () => {
  const anna = await adventurer();
  const { email, password } = anna;
  const newPassword = randomUUID();

  // The Account screen checks the current password by signing in with it before it changes anything.
  const wrong = await anna.client.auth.signInWithPassword({ email, password: 'not-the-password' });
  assert.equal(wrong.error?.code, 'invalid_credentials', 'a wrong current password is refused');
  assert.equal((await signIn(email, password)).error, null, 'the old password still works after the refusal');

  must(await anna.client.auth.signInWithPassword({ email, password }), 'check the current password');
  must(await anna.client.auth.updateUser({ password: newPassword }), 'change the password');
  assert.equal((await signIn(email, newPassword)).error, null, 'the new password signs in');
  assert.equal((await signIn(email, password)).error?.code, 'invalid_credentials', 'the old password is refused');

  const newEmail = email.replace('anna-', 'anna-moved-');
  const { user } = must(await anna.client.auth.updateUser({ email: newEmail }), 'ask for the new address');
  assert.equal(user.email, email, 'the address does not change before a link is opened');
  assert.equal(user.new_email, newEmail, 'Supabase remembers the address that waits for its confirmation');

  const toOld = confirmationLink(await waitForMail(email, CONFIRM_EMAIL_CHANGE));
  const toNew = confirmationLink(await waitForMail(newEmail, CONFIRM_EMAIL_CHANGE));
  assert.notEqual(toOld, toNew, 'each address gets its own link');
  assert.deepEqual(await storedEmail(anna.userId), { email, pending: newEmail }, 'the links alone change nothing');

  const first = await follow(toNew);
  if (BOTH_LINKS_NEEDED) {
    assert.match(first, /message=/, 'the first link is accepted and asks for the other one');
    assert.deepEqual(await storedEmail(anna.userId), { email, pending: newEmail }, 'one link does not change the address');
    assert.match(await follow(toOld), /type=email_change/, 'the second link completes the change');
  } else {
    assert.match(first, /type=email_change/, 'without sign-up confirmations, the first link completes the change');
    assert.match(await follow(toOld), /error_code=otp_expired/, 'the other link is spent');
  }
  assert.deepEqual(await storedEmail(anna.userId), { email: newEmail, pending: undefined }, 'the address is the new one and nothing waits');

  assert.equal((await signIn(newEmail, newPassword)).error, null, 'the new address and the new password sign in');
  assert.equal((await signIn(email, newPassword)).error?.code, 'invalid_credentials', 'the old address is refused');
});
