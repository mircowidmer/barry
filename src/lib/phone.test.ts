import { describe, expect, it } from '@jest/globals';

import { formatPhoneNumber, phoneInput } from './phone';

describe('formatPhoneNumber', () => {
  it('groups a Swiss number as +41 77 123 45 67', () => {
    expect(formatPhoneNumber('+41771234567')).toBe('+41 77 123 45 67');
    expect(formatPhoneNumber('+41 7712 34567')).toBe('+41 77 123 45 67');
  });

  it('leaves a number of another length as it is', () => {
    expect(formatPhoneNumber('+4915112345678')).toBe('+4915112345678');
    expect(formatPhoneNumber('+4179')).toBe('+4179');
  });
});

describe('phoneInput', () => {
  it('keeps only +, digits and spaces', () => {
    expect(phoneInput('+41 (77) 123-45-67')).toBe('+41 77 1234567');
    expect(phoneInput('abc+41 77')).toBe('+41 77');
  });
});
