import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { admin, adventurer, must } from './stack.mjs';

// docs/spec.md:16 "Each account has one Adventurer Profile."
test('an account cannot get a second Profile, nor a Profile for another account', async () => {
  const anna = await adventurer();

  const second = await anna.client.from('adventurer_profiles').insert({ id: anna.userId, name: 'Anna again' });
  assert.ok(second.error, 'a second Profile for the same account is refused');
  const other = await anna.client.from('adventurer_profiles').insert({ id: randomUUID(), name: 'Somebody else' });
  assert.ok(other.error, 'a Profile for another account is refused');

  const profiles = must(await admin.from('adventurer_profiles').select('name').eq('id', anna.userId), 'profiles');
  assert.deepEqual(profiles, [{ name: 'Anna' }], 'the account keeps its one Profile');
});
