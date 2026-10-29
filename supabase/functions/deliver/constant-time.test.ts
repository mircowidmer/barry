import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { sameSecret } from './constant-time.ts';

Deno.test('sameSecret accepts only the identical secret', () => {
  assertEquals(sameSecret('s3cret', 's3cret'), true);
  assertEquals(sameSecret('s3cret', 's3creT'), false);
  assertEquals(sameSecret('s3cret', 's3cre'), false);
  assertEquals(sameSecret('s3cret', 's3crets'), false);
  assertEquals(sameSecret('', 'x'), false);
});
