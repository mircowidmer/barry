import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adventurer, must } from './stack.mjs';

const save = (anna, id, destination, contactIds) =>
  anna.client.rpc('save_adventure', { p_id: id, p_destination: destination, p_deadline: null, p_contact_ids: contactIds });

// docs/spec.md § Plan changes "One Adventure reaches at most 10 different contacts over its time, counting those removed again; adding an
// eleventh is refused."
test('contacts swapped in and out of one Adventure count towards 10, and the eleventh is refused', async () => {
  const anna = await adventurer();
  const id = await anna.start();
  let n = 0;
  const fresh = () => anna.contact({ name: `C${++n}`, email: anna.luca.email.replace('luca-', `c${n}-`) });
  const swapIn = async (count) => {
    const added = [];
    for (let i = 0; i < count; i++) added.push(await fresh());
    return added;
  };
  const dropFromList = async (contacts) => {
    for (const c of contacts) {
      must(await anna.client.from('emergency_contacts').update({ removed_at: new Date().toISOString() }).eq('id', c.id), `delete ${c.name}`);
    }
  };

  const first = await swapIn(3);
  assert.equal(must(await save(anna, id, 'Grosser Mythen', [anna.luca.id, anna.sara.id, ...first.map((c) => c.id)]), 'reach 5')[0].refusal, null);
  must(await save(anna, id, 'Grosser Mythen', [anna.luca.id, anna.sara.id]), 'swap 3 out');
  await dropFromList(first);

  const second = await swapIn(3);
  assert.equal(must(await save(anna, id, 'Grosser Mythen', [anna.luca.id, anna.sara.id, ...second.map((c) => c.id)]), 'reach 8')[0].refusal, null);
  must(await save(anna, id, 'Grosser Mythen', [anna.luca.id, anna.sara.id]), 'swap 3 out again');
  await dropFromList(second);

  const third = await swapIn(3);
  const [refused] = must(await save(anna, id, 'Grosser Mythen', [anna.luca.id, anna.sara.id, ...third.map((c) => c.id)]), 'reach 11');
  assert.equal(refused.refusal, 'too_many_contacts', 'an eleventh contact over the Adventure\'s time is refused');
  const [ten] = must(await save(anna, id, 'Grosser Mythen', [anna.luca.id, anna.sara.id, third[0].id, third[1].id]), 'reach 10');
  assert.equal(ten.refusal, null, 'the tenth is still taken');
});
