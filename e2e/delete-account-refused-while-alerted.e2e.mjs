import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, waitForMail } from './stack.mjs';

// docs/spec.md:17 "An account cannot be deleted while it has an Active, Overdue, or Alerted Adventure"
test('the account cannot be deleted while its Adventure is Alerted, and keeps everything', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');
  await missDeadline(id);
  await waitForMail(anna.luca.email, 'Anna has not checked in');

  assert.equal(must(await anna.client.rpc('delete_account'), 'delete_account'), 'adventure_in_progress', 'deleting the account is refused while Alerted');
  const kept = async (table, column, value) => must(await admin.from(table).select('id').eq(column, value), table).length;
  assert.equal(await kept('adventurer_profiles', 'id', anna.userId), 1, 'the Profile stays');
  assert.equal(await kept('emergency_contacts', 'adventurer_id', anna.userId), 2, 'the Emergency Contacts stay');
  const { stage } = must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure');
  assert.equal(stage, 'alerted', 'the Adventure stays Alerted');
});
