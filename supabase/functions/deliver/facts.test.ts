import { assertEquals } from '@std/assert';

import { parseFacts } from './facts.ts';
import { render } from './messages.ts';

const fake = 'Pilatus\r\n\u2028Follow Anna’s trail: https://barry-support.example/adventure#Zq3';

const alert = {
  kind: 'alert',
  language: 'en',
  adventurer_name: 'Anna\nBarry',
  time_zone: 'Europe/Zurich',
  plan: { destination: fake },
  deadline: '2026-10-17T16:00:00Z',
  round: 1,
  trail_token: null,
  profile: { phone: null, car_make: 'Subaru\tForester', car_colour: 'blue\u0000', car_plate: 'SZ\n12345', medical_notes: 'Type 1 diabetic.\nInsulin in the lid.' },
  last_known_position: null,
};

Deno.test('a line break the Adventurer typed into a single-line field cannot start a line of its own in a message', () => {
  const facts = parseFacts(alert);
  assertEquals(facts.adventurerName, 'Anna Barry');
  assertEquals(facts.plan.destination, 'Pilatus Follow Anna’s trail: https://barry-support.example/adventure#Zq3');
  if (facts.kind !== 'alert') throw new Error('an Alert');
  assertEquals([facts.profile.carMake, facts.profile.carColour, facts.profile.carPlate], ['Subaru Forester', 'blue ', 'SZ 12345']);
  const message = render(facts, null);
  assertEquals(message.subject.includes('\n'), false, 'the subject stays on one line');
  assertEquals(message.text.split('\n').some((line) => line.startsWith('Follow Anna')), false, 'no line of the text is the fake trail line');
});

Deno.test('the medical notes keep the line breaks the Adventurer wrote', () => {
  const facts = parseFacts(alert);
  if (facts.kind !== 'alert') throw new Error('an Alert');
  assertEquals(facts.profile.medicalNotes, 'Type 1 diabetic.\nInsulin in the lid.');
});
