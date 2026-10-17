import { describe, expect, it } from '@jest/globals';

import { type AdventureWithRelations, parseAdventure, parseContact, parseProfile } from './rows';

const contact = {
  id: 'c1',
  adventurer_id: 'u1',
  name: 'Luca',
  email: 'luca@example.com',
  email_enabled: true,
  phone: null,
  phone_enabled: true,
  removed_at: null,
  created_at: '2026-10-15T08:00:00Z',
};

const row = (overrides: Partial<AdventureWithRelations>): AdventureWithRelations => ({
  id: 'a1',
  adventurer_id: 'u1',
  stage: 'planned',
  destination: null,
  route: null,
  starting_point: null,
  notes: null,
  deadline: null,
  alert_at: null,
  deadline_set_at: null,
  time_zone: null,
  started_at: null,
  alerts_sent: 0,
  plan_revision: 0,
  last_alert_at: null,
  checked_in_at: null,
  ended_at: null,
  created_at: '2026-10-15T08:00:00Z',
  updated_at: '2026-10-15T08:00:00Z',
  adventure_contacts: [{ emergency_contacts: contact }],
  last_position: [],
  ...overrides,
});

const started = {
  destination: 'Grosser Mythen',
  deadline: '2026-10-17T16:00:00Z',
  alert_at: '2026-10-17T16:30:00Z',
  deadline_set_at: '2026-10-17T06:00:00Z',
  time_zone: 'Europe/Zurich',
  started_at: '2026-10-17T06:00:00Z',
};

describe('parseAdventure', () => {
  it('parses a Planned Adventure with nothing filled in yet', () => {
    expect(parseAdventure(row({}))).toEqual({
      id: 'a1',
      stage: 'planned',
      plan: { destination: undefined, route: null, startingPoint: null, notes: null },
      deadline: null,
      contacts: [{ id: 'c1', name: 'Luca', email: 'luca@example.com', emailEnabled: true, phone: null, phoneEnabled: true }],
    });
  });

  it('parses an Overdue Adventure with its Alert time and the latest position', () => {
    const adventure = parseAdventure(
      row({
        ...started,
        stage: 'overdue',
        last_position: [{ taken_at: '2026-10-17T12:12:00Z', latitude: 47.03, longitude: 8.68, accuracy_m: 12 }],
      }),
    );
    expect(adventure).toMatchObject({
      stage: 'overdue',
      alertAt: new Date('2026-10-17T16:30:00Z'),
      lastKnownPosition: { latitude: 47.03, longitude: 8.68, accuracyM: 12, takenAt: new Date('2026-10-17T12:12:00Z') },
    });
  });

  it('parses an Ended Adventure with its Check-in time and Alert count', () => {
    expect(
      parseAdventure(row({ ...started, stage: 'ended', alerts_sent: 2, checked_in_at: '2026-10-17T18:00:00Z', ended_at: '2026-10-17T18:00:00Z' })),
    ).toMatchObject({ stage: 'ended', alertsSent: 2, checkedInAt: new Date('2026-10-17T18:00:00Z') });
  });

  it('refuses a started row the database checks should have made impossible', () => {
    expect(() => parseAdventure(row({ ...started, stage: 'active', deadline: null }))).toThrow('deadline is missing');
  });
});

describe('parseContact', () => {
  it('keeps a switched-off address with its switch', () => {
    expect(parseContact({ ...contact, phone: '+41792222222', phone_enabled: false })).toEqual({
      id: 'c1',
      name: 'Luca',
      email: 'luca@example.com',
      emailEnabled: true,
      phone: '+41792222222',
      phoneEnabled: false,
    });
  });

  it('refuses a contact with no address switched on', () => {
    expect(() => parseContact({ ...contact, email: null })).toThrow('no address switched on');
    expect(() => parseContact({ ...contact, email_enabled: false })).toThrow('no address switched on');
  });
});

describe('parseProfile', () => {
  const profile = {
    id: 'u1',
    name: 'Anna',
    phone: '+41790000001',
    car_make: null,
    car_colour: null,
    car_plate: null,
    medical_notes: null,
    message_language: 'de',
    created_at: '2026-10-15T08:00:00Z',
    updated_at: '2026-10-15T08:00:00Z',
  };

  it('leaves the message language to the phone', () => {
    expect(parseProfile(profile)).not.toHaveProperty('messageLanguage');
  });
});
