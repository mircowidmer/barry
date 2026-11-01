import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, must } from './stack.mjs';

// .claude/skills/barry-frontend-verify/features/profile.md § Sub-features "`profile-name-first` keeps the `Car` and `Medical Notes` rows dimmed until a name is stored, because the Profile cannot be stored without one."
// .claude/skills/barry-frontend-verify/features/profile.md § Driving it with the iOS Simulator "Paste the name back and replace `Phone Number` with `+4179`: still off, because a number needs `+`, a country code and at least six more digits."
test('the Profile cannot be stored without a name, and a phone number needs +, a country code and at least six more digits', async () => {
  const anna = await adventurer();
  const save = (fields) => anna.client.from('adventurer_profiles').update(fields).eq('id', anna.userId).select('id');
  const stored = async () =>
    must(await admin.from('adventurer_profiles').select('name, phone').eq('id', anna.userId).single(), 'the stored Profile');

  assert.equal((await save({ name: null })).error?.code, '23502', 'a Profile without a name is refused');
  assert.equal((await save({ name: '   ' })).error?.code, '23514', 'a name of only spaces is refused');
  assert.equal((await save({ phone: '+4179' })).error?.code, '23514', 'a number with too few digits after the country code is refused');
  assert.deepEqual(await stored(), { name: 'Anna', phone: '+41790000001' }, 'the refusals leave the stored Profile as it was');

  must(await save({ phone: null }), 'a Profile without a phone number');
  assert.deepEqual(await stored(), { name: 'Anna', phone: null }, 'the phone number is optional');
  must(await save({ phone: '+41791234567' }), 'a full phone number');
  assert.deepEqual(await stored(), { name: 'Anna', phone: '+41791234567' }, 'a number with +, a country code and nine more digits is stored');
});
