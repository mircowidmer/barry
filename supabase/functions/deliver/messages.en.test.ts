import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1.0.13';

import { parseFacts } from './facts.ts';
import { formatTime, render } from './messages.en.ts';

const base = {
  adventurer_name: 'Anna',
  contact_name: 'Luca',
  time_zone: 'Europe/Zurich',
  plan: { destination: 'Grosser Mythen', route: 'East ridge', starting_point: 'Brunni car park', notes: null },
  deadline: '2026-10-17T16:00:00Z',
};

const profile = {
  phone: '+41790000001',
  car_make: 'Subaru',
  car_colour: 'red',
  car_plate: 'SZ 12345',
  medical_notes: 'Type 1 diabetic',
};

Deno.test('formatTime names the time zone', () => {
  assertEquals(formatTime(new Date('2026-10-17T16:00:00Z'), 'Europe/Zurich'), 'Sat 17 Oct, 18:00 Zurich time');
  assertEquals(formatTime(new Date('2026-10-17T16:00:00Z'), 'America/New_York'), 'Sat 17 Oct, 12:00 New York time');
});

Deno.test('a Heads-up carries the Plan and the Deadline and nothing from the Profile', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'heads_up' }));
  assertEquals(subject, 'Anna is heading out to Grosser Mythen');
  assertEquals(
    text,
    [
      'Anna is going on an Adventure alone and chose you as an Emergency Contact on Barry.',
      '',
      'Destination: Grosser Mythen',
      'Route: East ridge',
      'Starting point: Brunni car park',
      '',
      'If Anna has not checked in by Sat 17 Oct, 18:00 Zurich time, Barry will message you again.',
    ].join('\n'),
  );
});

Deno.test('an Alert carries the Plan, the Last Known Position and the Profile', () => {
  const { subject, text } = render(
    parseFacts({
      ...base,
      kind: 'alert',
      round: 1,
      profile,
      last_known_position: { taken_at: '2026-10-17T12:12:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 },
    }),
  );
  assertEquals(subject, 'Anna has not checked in');
  assertEquals(
    text,
    [
      'Anna has not checked in from an Adventure. The Deadline was Sat 17 Oct, 18:00 Zurich time.',
      '',
      'Destination: Grosser Mythen',
      'Route: East ridge',
      'Starting point: Brunni car park',
      '',
      'Last Known Position at Sat 17 Oct, 14:12 Zurich time: 47.03000, 8.68000 (within 12 m)',
      'Map: https://www.openstreetmap.org/?mlat=47.03&mlon=8.68#map=15/47.03/8.68',
      '',
      "Anna's phone: +41790000001",
      'Car: red Subaru, SZ 12345',
      'Medical notes: Type 1 diabetic',
    ].join('\n'),
  );
});

Deno.test('a later Alert says which round it is, and a missing position says so', () => {
  const { subject, text } = render(
    parseFacts({ ...base, kind: 'alert', round: 2, profile: { phone: '+41790000001' }, last_known_position: null }),
  );
  assertEquals(subject, 'Anna has still not checked in (Alert 2 of 3)');
  assertStringIncludes(text, 'Last Known Position: not recorded');
});

Deno.test('the Overdue Notice says when the Alert goes out', () => {
  const { text } = render(parseFacts({ ...base, kind: 'overdue_notice', alert_at: '2026-10-17T16:30:00Z' }));
  assertEquals(
    text,
    'Your Deadline for Grosser Mythen was Sat 17 Oct, 18:00 Zurich time. Barry alerts your Emergency Contacts at Sat 17 Oct, 18:30 Zurich time unless you check in.',
  );
});

Deno.test('the All-clear gives the Check-in time', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'all_clear', checked_in_at: '2026-10-17T17:05:00Z' }));
  assertEquals(subject, 'Anna is back safe');
  assertEquals(text, 'Anna checked in safely at Sat 17 Oct, 19:05 Zurich time.');
});
