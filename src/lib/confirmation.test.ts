import { describe, expect, it } from '@jest/globals';

import { confirmationError } from './confirmation';

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
