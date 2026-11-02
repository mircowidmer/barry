import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, missDeadline, must, waitForMail, waitForText } from './stack.mjs';

// docs/spec.md § Accounts "The Adventurer logs out from the Profile tab with **Log Out** … The Adventure itself goes on, and Barry still
// alerts the contacts if the Deadline passes."
test('after the Adventurer logs out, the Adventure goes on and Barry still alerts the contacts when the Deadline passes', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await waitForText(anna.sara.phone, 'Anna is going on an adventure alone');

  try {
    // As the app's logOut does: a global sign-out, which also ends the session on the server.
    must(await anna.client.auth.signOut(), 'log out');
    assert.equal((await anna.client.auth.getSession()).data.session, null, 'Anna is logged out');
    const { error } = await anna.client.from('adventures').select('id');
    assert.match(error?.message ?? '', /permission denied/, 'the logged-out phone can no longer read the Adventure');

    await missDeadline(id);
    const alert = await waitForMail(anna.luca.email, 'Anna has not checked in');
    assert.match(alert.Text, /Destination: Grosser Mythen/, 'Luca gets the Alert');
    await waitForText(anna.sara.phone, 'Anna has not checked in from an adventure');
  } finally {
    // The fixture checks the Adventure in with this client before it deletes the account.
    must(await anna.client.auth.signInWithPassword({ email: anna.email, password: anna.password }), 'sign in again');
  }
});
