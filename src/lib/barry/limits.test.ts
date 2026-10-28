import { describe, expect, it } from '@jest/globals';

import { LIMITS } from './limits';

describe('LIMITS', () => {
  it('matches what the migration enforces, which limits.test.sql pins on the server side', () => {
    expect(LIMITS).toEqual({
      contacts: 10,
      adventureContacts: 5,
      startsPerDay: 5,
      destinationLength: 200,
      nameLength: 100,
      carMakeLength: 50,
      carColourLength: 50,
      carPlateLength: 20,
      medicalNotesLength: 500,
    });
  });
});
