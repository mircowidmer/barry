import { describe, expect, it, jest } from '@jest/globals';

import { confirmationError, confirmedWhat, linkSession, revokeLinkSession, withoutFragment } from './confirmation';

describe('confirmationError', () => {
  it('finds no error after a working confirmation link', () => {
    expect(confirmationError('https://barry.support/confirmed#access_token=abc&type=signup')).toBeNull();
  });

  it('reads an expired link from the fragment', () => {
    expect(
      confirmationError(
        'https://barry.support/confirmed#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('expired');
  });

  it('reads any other failure, from the query too, without taking its text', () => {
    expect(confirmationError('https://barry.support/confirmed?error=access_denied')).toBe('failed');
    expect(confirmationError('https://barry.support/confirmed#error_description=Your+account+is+locked.+Call+us')).toBeNull();
    expect(confirmationError('https://barry.support/confirmed#error=x&error_description=Your+account+is+locked')).toBe('failed');
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

describe('the session a confirmation link hands the browser', () => {
  const href = 'https://barry.support/confirmed#access_token=abc&refresh_token=def&type=signup';

  it('is read from the fragment, and a link without one has none', () => {
    expect(linkSession(href)).toBe('abc');
    expect(linkSession('https://barry.support/confirmed#error=access_denied')).toBeNull();
  });

  it('is ended on Supabase for this session only', async () => {
    const fetchFn = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    await revokeLinkSession(fetchFn as typeof fetch, 'https://db.example', 'sb_publishable_x')('abc');
    expect(fetchFn).toHaveBeenCalledWith('https://db.example/auth/v1/logout?scope=local', {
      method: 'POST',
      headers: { apikey: 'sb_publishable_x', Authorization: 'Bearer abc' },
    });
  });

  it('leaves the address without the fragment that carried it', () => {
    expect(withoutFragment(href)).toBe('/confirmed');
    expect(withoutFragment('https://barry.support/confirmed?lang=de#access_token=abc')).toBe('/confirmed?lang=de');
  });
});
