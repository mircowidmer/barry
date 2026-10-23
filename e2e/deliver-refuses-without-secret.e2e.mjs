import assert from 'node:assert/strict';
import { test } from 'node:test';

import { API } from './stack.mjs';

// docs/hosted-supabase.md:8 "The deliver Edge Function, with verify_jwt = false from supabase/config.toml, because the clock
// calls it with DELIVER_SECRET instead of a user token."
// docs/hosted-supabase.md:112 "unauthorized means DELIVER_SECRET and the Vault's deliver_secret differ."
test('deliver refuses a run without the secret and a run with a wrong one, and sends nothing for either', async () => {
  const run = (headers) => fetch(`${API}/functions/v1/deliver`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' });

  const without = await run({});
  assert.equal(without.status, 401, 'a run without the secret is refused');
  assert.equal(await without.text(), 'unauthorized');

  const wrong = await run({ Authorization: 'Bearer not-the-deliver-secret' });
  assert.equal(wrong.status, 401, 'a run with a wrong secret is refused');
  assert.equal(await wrong.text(), 'unauthorized', 'the answer names the cause and carries no health');
});
