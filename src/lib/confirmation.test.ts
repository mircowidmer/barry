import { describe, expect, it } from '@jest/globals';

import { confirmationError, confirmedWhat } from './confirmation';

describe('confirmationError', () => {
  it('finds no error after a working confirmation link', () => {
    expect(confirmationError('https://barry.support/confirmed#access_token=abc&type=signup')).toBeNull();
  });

  it('reads the reason from the fragment of an expired link', () => {
    expect(
      confirmationError(
        'https://barry.support/confirmed#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('Email link is invalid or has expired');
  });

  it('reads the reason from the query too', () => {
    expect(confirmationError('https://barry.support/confirmed?error=access_denied')).toBe('access_denied');
  });
});

describe('confirmedWhat', () => {
  it('is a new account after a sign-up link', () => {
    expect(confirmedWhat('https://barry.support/confirmed#access_token=abc&type=signup')).toBe('account');
    expect(confirmedWhat('https://barry.support/confirmed')).toBe('account');
  });

  it('is the first of the two links of an address change when Supabase asks for the other one', () => {
    expect(
      confirmedWhat(
        'https://barry.support/confirmed#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email',
      ),
    ).toBe('email_change_first');
  });

  it('is the completed address change after the second link', () => {
    expect(confirmedWhat('https://barry.support/confirmed#access_token=abc&refresh_token=def&type=email_change')).toBe('email_change');
    expect(confirmedWhat('https://barry.support/confirmed?type=email_change')).toBe('email_change');
  });
});
