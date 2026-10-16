import { assertEquals } from 'jsr:@std/assert@1.0.13';

import { parseFacts } from './facts.ts';
import { trailMapLinks } from './links.ts';
import { formatTime } from './messages.de.ts';
import { render } from './messages.ts';

const links = trailMapLinks('http://localhost:8081/adventure');
const token = 'Xk3vQ9pL2mN8rT5wY1zA0b';

const base = {
  language: 'de',
  adventurer_name: 'Anna',
  contact_name: 'Luca',
  time_zone: 'Europe/Zurich',
  plan: { destination: 'Grosser Mythen', route: 'Ostgrat', starting_point: 'Parkplatz Brunni', notes: null },
  deadline: '2026-10-17T16:00:00Z',
};

const profile = {
  phone: '+41790000001',
  car_make: 'Subaru',
  car_colour: 'rot',
  car_plate: 'SZ 12345',
  medical_notes: 'Diabetes Typ 1',
};

Deno.test('the German time names the weekday, the day, the month and the time', () => {
  assertEquals(formatTime(new Date('2026-10-17T16:00:00Z'), 'Europe/Zurich'), 'Sa, 17. Okt. um 18:00');
  assertEquals(formatTime(new Date('2026-03-02T07:05:00Z'), 'Europe/Zurich'), 'Mo, 2. März um 08:05');
});

Deno.test('a Profile without a language gets the English texts', () => {
  const { language: _, ...english } = base;
  assertEquals(render(parseFacts({ ...english, kind: 'all_clear', checked_in_at: '2026-10-17T17:05:00Z' }), links).subject, 'Anna is back safe');
});

Deno.test('the German Heads-up carries the Plan, the Deadline and the Trail Map link', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'heads_up', trail_token: token }), links);
  assertEquals(subject, 'Anna ist unterwegs: Grosser Mythen');
  assertEquals(
    text,
    [
      'Anna ist allein auf einem Abenteuer und hat dich auf Barry als Notfallkontakt angegeben. Barry ist hier der Wachhund: Er bellt nur, wenn sich Anna nicht rechtzeitig zurückmeldet.',
      '',
      'Ziel: Grosser Mythen',
      'Route: Ostgrat',
      'Startpunkt: Parkplatz Brunni',
      '',
      'Wenn sich Anna bis Sa, 17. Okt. um 18:00 nicht zurückgemeldet hat, meldet sich Barry wieder bei dir.',
      '',
      `Hier siehst du, wo Anna unterwegs ist: http://localhost:8081/adventure#${token}`,
    ].join('\n'),
  );
});

Deno.test('the German Alert carries the Last Known Position and the Profile', () => {
  const { subject, text } = render(
    parseFacts({
      ...base,
      kind: 'alert',
      round: 2,
      trail_token: null,
      profile,
      last_known_position: { taken_at: '2026-10-17T12:12:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 },
    }),
    links,
  );
  assertEquals(subject, 'Anna hat sich immer noch nicht zurückgemeldet (Alarm 2 von 3)');
  assertEquals(
    text,
    [
      'Anna hat sich nach einem Abenteuer immer noch nicht zurückgemeldet (Alarm 2 von 3). Die vereinbarte Rückkehrzeit war am Sa, 17. Okt. um 18:00.',
      '',
      'Ziel: Grosser Mythen',
      'Route: Ostgrat',
      'Startpunkt: Parkplatz Brunni',
      '',
      'Letzter bekannter Standort am Sa, 17. Okt. um 14:12: 47.03000, 8.68000 (auf 12 m genau)',
      'Karte: https://www.openstreetmap.org/?mlat=47.03&mlon=8.68#map=15/47.03/8.68',
      '',
      'Telefon von Anna: +41790000001',
      'Auto: rot Subaru, SZ 12345',
      'Medizinische Hinweise: Diabetes Typ 1',
    ].join('\n'),
  );
});

Deno.test('the German All-clear gives the Check-in time', () => {
  const { subject, text } = render(parseFacts({ ...base, kind: 'all_clear', checked_in_at: '2026-10-17T17:05:00Z' }), links);
  assertEquals(subject, 'Anna ist sicher zurück');
  assertEquals(text, 'Anna hat sich am Sa, 17. Okt. um 19:05 sicher zurückgemeldet. Barry muss sich keine Sorgen mehr machen, und du auch nicht.');
});

const GSM_7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà' +
  '^{}\\[~]|€';

Deno.test('every German text message body uses only the GSM-7 alphabet, so it is not sent at the UCS-2 rate', () => {
  const bodies = [
    render(parseFacts({ ...base, kind: 'heads_up', trail_token: token }), links),
    render(parseFacts({ ...base, kind: 'plan_update', trail_token: token }), links),
    render(
      parseFacts({
        ...base,
        kind: 'alert',
        round: 1,
        trail_token: token,
        profile,
        last_known_position: { taken_at: '2026-10-17T12:12:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 },
      }),
      links,
    ),
    render(parseFacts({ ...base, kind: 'alert', round: 3, profile, last_known_position: null, trail_token: null }), links),
    render(parseFacts({ ...base, kind: 'all_clear', checked_in_at: '2026-10-17T17:05:00Z' }), links),
  ].map((message) => message.text);
  for (const body of bodies) {
    assertEquals([...body].filter((c) => !GSM_7.includes(c)), [], body.split('\n')[0]);
  }
});
