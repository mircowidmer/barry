import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CURRENT_TERMS } from './site';
import { recordTermsSeen, termsDay, termsOutdated } from './terms';

describe('CURRENT_TERMS', () => {
  it('is the date the Terms of Use page names in English and German', () => {
    const page = readFileSync(join(__dirname, '../../web/terms.html'), 'utf8');
    const day = termsDay();
    const english = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const german = day.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
    expect(CURRENT_TERMS).toBe('2026-10-22');
    expect(page).toContain(`Last updated ${english}`);
    expect(page).toContain(`Stand: ${german}`);
  });
});

describe('termsOutdated', () => {
  it('tells an account with no version or an older one, and not one that has seen these terms or newer', () => {
    expect(termsOutdated({ user_metadata: {} })).toBe(true);
    expect(termsOutdated({ user_metadata: { terms_version: '2026-01-01' } })).toBe(true);
    expect(termsOutdated({ user_metadata: { terms_version: CURRENT_TERMS } })).toBe(false);
    expect(termsOutdated({ user_metadata: { terms_version: '2099-01-01' } })).toBe(false);
  });
});

describe('recordTermsSeen', () => {
  it('stores the current version in the Auth user metadata and says whether it landed', async () => {
    const calls: unknown[] = [];
    const auth = (error: { message: string } | null) => ({
      updateUser: async (args: unknown) => {
        calls.push(args);
        return { data: {}, error };
      },
    });
    expect(await recordTermsSeen(auth(null) as never)).toBe(true);
    expect(await recordTermsSeen(auth({ message: 'offline' }) as never)).toBe(false);
    expect(calls).toEqual([{ data: { terms_version: CURRENT_TERMS } }, { data: { terms_version: CURRENT_TERMS } }]);
  });
});
