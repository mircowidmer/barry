import { describe, expect, it } from '@jest/globals';

import { clip, LIMITS } from './limits';

describe('LIMITS', () => {
  it('matches what the migration enforces, which limits.test.sql pins on the server side', () => {
    expect(LIMITS).toEqual({
      contacts: 10,
      adventureContacts: 5,
      startsPerDay: 5,
      alertsPerDeadline: 3,
      alertsPerAdventure: 9,
      destinationLength: 200,
      nameLength: 100,
      emailLength: 254,
      carMakeLength: 50,
      carColourLength: 50,
      carPlateLength: 20,
      medicalNotesLength: 500,
    });
  });
});

describe('clip', () => {
  it('cuts at whole characters as Postgres counts them, never inside an emoji', () => {
    expect(clip('ab🏔️c', 3)).toBe('ab🏔');
    expect(clip('🏔'.repeat(3), 2)).toBe('🏔🏔');
    expect(clip('short', 100)).toBe('short');
  });
});
