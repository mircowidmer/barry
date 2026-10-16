import { describe, expect, it } from '@jest/globals';

import { formatWhenGerman } from './wording';
import { preferredLanguage, siteText } from './site-language';

describe('preferredLanguage', () => {
  it('is German when the first preferred language is any German', () => {
    expect(preferredLanguage(['de-CH', 'en'])).toBe('de');
    expect(preferredLanguage(['de'])).toBe('de');
  });

  it('is English otherwise, also when German comes second', () => {
    expect(preferredLanguage(['en-GB', 'de-CH'])).toBe('en');
    expect(preferredLanguage(['fr-CH'])).toBe('en');
    expect(preferredLanguage([])).toBe('en');
  });
});

describe('German page text', () => {
  it('writes the time like the German messages', () => {
    expect(formatWhenGerman(new Date(2026, 9, 17, 18, 5))).toBe('Sa, 17. Okt. um 18:05');
  });

  it('puts the name before Abenteuer, with an apostrophe after an s', () => {
    expect(siteText.de.adventureOf('Anna')).toBe('Annas Abenteuer');
    expect(siteText.de.adventureOf('Hans')).toBe('Hans’ Abenteuer');
  });
});
