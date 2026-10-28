import { describe, expect, it } from '@jest/globals';

import { copyPhoneContact, fullPhoneNumber, MOBILE_LABELS, type PhoneContact } from './phone-contact';

const picked = (overrides: Partial<PhoneContact>): PhoneContact => ({
  fullName: 'Sara Keller',
  company: null,
  phones: [],
  emails: [],
  ...overrides,
});

describe('fullPhoneNumber', () => {
  it('reads a number without country code in the phone’s region, dropping the trunk zero', () => {
    expect(fullPhoneNumber('079 123 45 67', 'CH')).toBe('+41791234567');
    expect(fullPhoneNumber('0151 12345678', 'de')).toBe('+4915112345678');
  });

  it('keeps the country code a number already has, whatever the region', () => {
    expect(fullPhoneNumber('+41 79 123 45 67', 'US')).toBe('+41791234567');
    expect(fullPhoneNumber('+41 79 123 45 67', null)).toBe('+41791234567');
  });

  it('gives null for a number without country code when the region is unknown, and for a number too short to be one', () => {
    expect(fullPhoneNumber('079 123 45 67', null)).toBeNull();
    expect(fullPhoneNumber('079 123 45 67', 'XX')).toBeNull();
    expect(fullPhoneNumber('12', 'CH')).toBeNull();
  });
});

describe('copyPhoneContact', () => {
  it('pins the labels of a number that can get a text message', () => {
    expect(MOBILE_LABELS).toEqual(['mobile', 'mobil', 'iphone', 'cell']);
  });

  it('takes the first mobile number before an earlier landline, and the first email', () => {
    const copy = copyPhoneContact(
      picked({
        phones: [
          { label: 'home', number: '044 123 45 67' },
          { label: 'Mobil', number: '079 123 45 67' },
          { label: 'iPhone', number: '078 000 00 00' },
        ],
        emails: [{ label: 'work', address: 'sara@work.example' }, { label: 'home', address: 'sara@home.example' }],
      }),
      'CH',
    );
    expect(copy).toEqual({ name: 'Sara Keller', email: 'sara@work.example', phone: '+41791234567' });
  });

  it('reads a number in the region the phone gave it before the phone’s own region', () => {
    const copy = copyPhoneContact(picked({ phones: [{ label: 'mobile', number: '0151 12345678', region: 'de' }] }), 'CH');
    expect(copy.phone).toBe('+4915112345678');
  });

  it('falls back to the first other number when no mobile number can be read', () => {
    const copy = copyPhoneContact(picked({ phones: [{ label: 'mobile', number: '12' }, { label: 'home', number: '044 123 45 67' }] }), 'CH');
    expect(copy.phone).toBe('+41441234567');
  });

  it('skips an email address that is not one', () => {
    const copy = copyPhoneContact(picked({ emails: [{ address: 'sara@' }, { address: 'sara@example.com' }] }), 'CH');
    expect(copy.email).toBe('sara@example.com');
  });

  it('leaves both addresses null when there is nothing Barry can use', () => {
    const copy = copyPhoneContact(picked({ phones: [{ label: 'mobile', number: '079 123 45 67' }], emails: [{ address: 'nope' }] }), null);
    expect(copy).toEqual({ name: 'Sara Keller', email: null, phone: null });
  });

  it('names a contact without a name after the company, then the email, then the number', () => {
    expect(copyPhoneContact(picked({ fullName: ' ', company: 'Rega', emails: [{ address: 'info@rega.example' }] }), 'CH').name).toBe('Rega');
    expect(copyPhoneContact(picked({ fullName: '', emails: [{ address: 'info@rega.example' }] }), 'CH').name).toBe('info@rega.example');
    expect(copyPhoneContact(picked({ fullName: '', phones: [{ number: '079 123 45 67' }] }), 'CH').name).toBe('+41 79 123 45 67');
    expect(copyPhoneContact(picked({ fullName: '' }), 'CH').name).toBe('');
  });

  it('cuts a name to the 100 characters the server takes', () => {
    expect(copyPhoneContact(picked({ fullName: 'N'.repeat(150) }), 'CH').name).toHaveLength(100);
  });
});
