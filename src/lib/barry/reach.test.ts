import { describe, expect, it } from '@jest/globals';

import { isEmailAddress, isPhoneNumber } from './reach';

describe('isEmailAddress', () => {
  it('accepts an address with a name, an @ and a domain', () => {
    expect(isEmailAddress('luca@example.com')).toBe(true);
    expect(isEmailAddress('  luca@example.com ')).toBe(true);
  });

  it('refuses an empty field and an address without a domain', () => {
    expect(isEmailAddress('')).toBe(false);
    expect(isEmailAddress('luca@')).toBe(false);
    expect(isEmailAddress('luca@example')).toBe(false);
    expect(isEmailAddress('luca example@example.com')).toBe(false);
  });
});

describe('isPhoneNumber', () => {
  it('accepts a number with + and country code, also with spaces', () => {
    expect(isPhoneNumber('+41791111111')).toBe(true);
    expect(isPhoneNumber('+41 79 111 11 11')).toBe(true);
  });

  it('refuses an empty field, a number without country code and a half-typed number', () => {
    expect(isPhoneNumber('')).toBe(false);
    expect(isPhoneNumber('0791111111')).toBe(false);
    expect(isPhoneNumber('+4179')).toBe(false);
  });
});
