import assert from 'node:assert/strict';
import { test } from 'node:test';

import { admin, adventurer, missDeadline, must, tick, waitForMail } from './stack.mjs';

// docs/spec.md:19 "An account cannot be deleted while it has an Active, Overdue, or Alerted Adventure"
test('the account cannot be deleted while its Adventure is Overdue, and keeps everything', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  await waitForMail(anna.luca.email, 'Anna is heading out to Grosser Mythen');

  await missDeadline(id, 0.2);
  tick();
  const stage = async () => must(await admin.from('adventures').select('stage').eq('id', id).single(), 'adventure').stage;
  assert.equal(await stage(), 'overdue');

  assert.equal(must(await anna.client.rpc('delete_account'), 'delete_account'), 'adventure_in_progress', 'deleting the account is refused while Overdue');
  const kept = async (table, column, value) => must(await admin.from(table).select('id').eq(column, value), table).length;
  assert.equal(await kept('adventurer_profiles', 'id', anna.userId), 1, 'the Profile stays');
  assert.equal(await kept('emergency_contacts', 'adventurer_id', anna.userId), 2, 'the Emergency Contacts stay');
  assert.equal(await stage(), 'overdue', 'the Adventure stays Overdue');
});
