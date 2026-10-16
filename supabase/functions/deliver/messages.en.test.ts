import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1.0.13';

import { parseFacts } from './facts.ts';
import { trailMapLinks } from './links.ts';
import { formatTime, render } from './messages.en.ts';

const links = trailMapLinks('http://localhost:8081/adventure');
const token = 'Xk3vQ9pL2mN8rT5wY1zA0b';

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

Deno.test('formatTime shows the time in the given time zone', () => {
  assertEquals(formatTime(new Date('2026-10-17T16:00:00Z'), 'Europe/Zurich'), 'Sat 17 Oct, 18:00');
  assertEquals(formatTime(new Date('2026-10-17T16:00:00Z'), 'America/New_York'), 'Sat 17 Oct, 12:00');
});

Deno.test('a Heads-up carries the Plan and the Deadline and nothing from the Profile', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'heads_up', trail_token: token }), links);
  assertEquals(subject, 'Anna is heading out to Grosser Mythen');
  assertEquals(
    text,
    [
      'Anna is going on an adventure alone and chose you as an Emergency Contact on Barry. Barry is the watchdog here: he only barks if Anna does not check in in time.',
      '',
      'Destination: Grosser Mythen',
      'Route: East ridge',
      'Starting Point: Brunni car park',
      '',
      'If Anna has not checked in by Sat 17 Oct, 18:00, Barry will message you again.',
      '',
      "Follow Anna's Trail: http://localhost:8081/adventure#Xk3vQ9pL2mN8rT5wY1zA0b",
    ].join('\n'),
  );
});

Deno.test('a Plan update carries the new Plan, the Deadline and the Trail Map link', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'plan_update', trail_token: token }), links);
  assertEquals(subject, 'Anna changed the Plan for Grosser Mythen');
  assertEquals(
    text,
    [
      'Anna changed the Plan, and Barry has sniffed out the new details.',
      '',
      'Destination: Grosser Mythen',
      'Route: East ridge',
      'Starting Point: Brunni car park',
      '',
      'If Anna has not checked in by Sat 17 Oct, 18:00, Barry will message you again.',
      '',
      "Follow Anna's Trail: http://localhost:8081/adventure#Xk3vQ9pL2mN8rT5wY1zA0b",
    ].join('\n'),
  );
});

Deno.test('an Alert carries the Plan, the Last Known Position and the Profile', () => {
  const { subject, text } = render(
    parseFacts({
      ...base,
      kind: 'alert',
      round: 1,
      trail_token: token,
      profile,
      last_known_position: { taken_at: '2026-10-17T12:12:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 },
    }),
    links,
  );
  assertEquals(subject, 'Anna has not checked in');
  assertEquals(
    text,
    [
      'Anna has not checked in from an adventure. The Deadline was Sat 17 Oct, 18:00.',
      '',
      'Destination: Grosser Mythen',
      'Route: East ridge',
      'Starting Point: Brunni car park',
      '',
      'Last Known Position at Sat 17 Oct, 14:12: 47.03000, 8.68000 (within 12 m)',
      'Map: https://www.openstreetmap.org/?mlat=47.03&mlon=8.68#map=15/47.03/8.68',
      "Follow Anna's Trail: http://localhost:8081/adventure#Xk3vQ9pL2mN8rT5wY1zA0b",
      '',
      "Anna's phone: +41790000001",
      'Car: red Subaru, SZ 12345',
      'Medical Notes: Type 1 diabetic',
    ].join('\n'),
  );
});

Deno.test('a later Alert says which round it is, and a missing position says so', () => {
  const { subject, text } = render(
    parseFacts({ ...base, kind: 'alert', round: 2, profile: { phone: '+41790000001' }, last_known_position: null }),
    links,
  );
  assertEquals(subject, 'Anna has still not checked in (Alert 2 of 3)');
  assertStringIncludes(text, 'Anna has still not checked in from an adventure (Alert 2 of 3).');
  assertStringIncludes(text, 'Last Known Position: not recorded');
});

Deno.test('the Overdue Notice says when the Alert goes out', () => {
  const { text } = render(parseFacts({ ...base, kind: 'overdue_notice', alert_at: '2026-10-17T16:30:00Z' }), links);
  assertEquals(
    text,
    'Your Deadline for Grosser Mythen was Sat 17 Oct, 18:00. Barry alerts your emergency contacts at Sat 17 Oct, 18:30 unless you check in.',
  );
});

Deno.test('the All-clear gives the Check-in time', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'all_clear', checked_in_at: '2026-10-17T17:05:00Z' }), links);
  assertEquals(subject, '🐶 Anna is back safe');
  assertEquals(text, 'Anna checked in safely at Sat 17 Oct, 19:05. Barry can stop worrying, and so can you.');
});

Deno.test('without a link base or a token the Heads-up and the Alert go out without the Trail Map line', () => {
  const headsUp = render(parseFacts({ ...base, kind: 'heads_up', trail_token: token }), null).text;
  const removed = render(parseFacts({ ...base, kind: 'heads_up', trail_token: null }), links).text;
  const alert = render(parseFacts({ ...base, kind: 'alert', round: 1, profile, last_known_position: null, trail_token: null }), links).text;
  assertEquals(headsUp.endsWith('Barry will message you again.'), true, 'Heads-up without a base ends with the Deadline sentence');
  assertEquals(removed.endsWith('Barry will message you again.'), true, 'Heads-up without a token ends with the Deadline sentence');
  assertEquals(alert.includes('Trail'), false, 'Alert without a token has no Trail line');
});

Deno.test('an unset or invalid TRAIL_MAP_URL gives no links', () => {
  assertEquals(trailMapLinks(undefined), null);
  assertEquals(trailMapLinks('not a url'), null);
});

const GSM_7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€';

Deno.test('every text message body uses only the GSM-7 alphabet, so it is not sent at the UCS-2 rate', () => {
  const bodies = [
    render(parseFacts({ ...base, kind: 'heads_up', trail_token: token }), links),
    render(parseFacts({ ...base, kind: 'plan_update', trail_token: token }), links),
    render(
      parseFacts({
        ...base,
        kind: 'alert',
        round: 2,
        trail_token: token,
        profile,
        last_known_position: { taken_at: '2026-10-17T12:12:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 },
      }),
      links,
    ),
    render(parseFacts({ ...base, kind: 'alert', round: 1, profile, last_known_position: null, trail_token: null }), links),
    render(parseFacts({ ...base, kind: 'all_clear', checked_in_at: '2026-10-17T17:05:00Z' }), links),
  ].map((message) => message.text);
  for (const body of bodies) {
    assertEquals([...body].filter((c) => !GSM_7.includes(c)), [], body.split('\n')[0]);
  }
});
