import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { authorizedKick } from './kick.ts';

Deno.test('a run starts only for the secret as a bearer token', () => {
  assertEquals(authorizedKick('Bearer test-deliver-secret', 'test-deliver-secret'), true);
  assertEquals(authorizedKick('Bearer wrong', 'test-deliver-secret'), false);
  assertEquals(authorizedKick(null, 'test-deliver-secret'), false);
});

Deno.test('without DELIVER_SECRET no request starts a run', () => {
  assertEquals(authorizedKick('Bearer undefined', undefined), false);
  assertEquals(authorizedKick('Bearer ', ''), false);
});
