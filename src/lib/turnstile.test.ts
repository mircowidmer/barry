import { describe, expect, it } from '@jest/globals';

import { turnstilePage, turnstileToken } from './turnstile';

describe('turnstilePage', () => {
  it('renders the widget with the site key as a script string', () => {
    const page = turnstilePage('0x4AAAAAAA"x');
    expect(page).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(page).toContain('sitekey: "0x4AAAAAAA\\"x"');
  });
});

describe('turnstileToken', () => {
  it('reads the token the page posts, and null when it is lost or the message is not one', () => {
    expect(turnstileToken('{"token":"abc"}')).toBe('abc');
    expect(turnstileToken('{"token":null}')).toBeNull();
    expect(turnstileToken('{"token":""}')).toBeNull();
    expect(turnstileToken('not json')).toBeNull();
  });
});
