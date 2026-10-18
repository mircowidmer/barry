import { useEffect, useSyncExternalStore } from 'react';

import { formatWhen, formatWhenGerman } from '@/lib/wording';

export type SiteLanguage = 'en' | 'de';

/** German when the browser's first preferred language is German, English otherwise. */
export const preferredLanguage = (languages: readonly string[]): SiteLanguage =>
  /^de\b/i.test(languages[0] ?? '') ? 'de' : 'en';

const browserLanguages = () => (navigator.languages?.length ? navigator.languages : [navigator.language]);

/** The static export renders English, and the browser switches to German after it loads. */
export const useSiteLanguage = (): SiteLanguage => {
  const language = useSyncExternalStore(
    (changed) => {
      addEventListener('languagechange', changed);
      return () => removeEventListener('languagechange', changed);
    },
    () => preferredLanguage(browserLanguages()),
    () => 'en' as const,
  );
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return language;
};

const position = (coordinates: { latitude: number; longitude: number }) =>
  `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;

type Position = { takenAt: Date; latitude: number; longitude: number; accuracyM: number | null };

export const siteText = {
  en: {
    logo: "Barry's icon, a St. Bernard with a little barrel on its collar",
    adventure: 'Adventure',
    loading: 'Loading…',
    linkBroken: 'This link does not work.',
    unreachable: 'Barry cannot be reached. Try again in a moment.',
    adventureOf: (name: string) => `${name}'s Adventure`,
    updatesEveryMinute: 'Barry updates this map every minute.',
    staleSince: (since: Date) => `Barry cannot be reached since ${formatWhen(since)}. This is the last update it sent.`,
    alerted: (name: string) => `${name} has not checked in. Barry has raised the alert.`,
    checkedIn: (name: string, at: Date) => `${name} checked in at ${formatWhen(at)}.`,
    lastKnownPosition: (p: Position | null) =>
      p
        ? `Last known position at ${formatWhen(p.takenAt)}: ${position(p)}` + (p.accuracyM === null ? '' : ` (within ${Math.round(p.accuracyM)} m)`)
        : 'Last known position: not recorded',
    plan: 'Plan',
    destination: 'Destination',
    route: 'Route',
    linkFailed: 'This link did not work',
    newLink: 'Open Barry and tap Create account again to get a new link.',
    emailConfirmed: 'Your email is confirmed',
    welcome: 'Welcome to Barry. Go alone, get home.',
    signInHint: 'Open Barry on your iPhone and sign in with your email and password.',
    openBarry: 'Open Barry and sign in',
  },
  de: {
    logo: 'Barrys Symbol, ein Bernhardiner mit einem kleinen Fässchen am Halsband',
    adventure: 'Abenteuer',
    loading: 'Wird geladen…',
    linkBroken: 'Dieser Link funktioniert nicht.',
    unreachable: 'Barry ist nicht erreichbar. Versuch es gleich nochmals.',
    adventureOf: (name: string) => (/[sxzß]$/i.test(name) ? `${name}’ Abenteuer` : `${name}s Abenteuer`),
    updatesEveryMinute: 'Barry aktualisiert diese Karte jede Minute.',
    staleSince: (since: Date) =>
      `Barry ist seit ${formatWhenGerman(since)} nicht erreichbar. Das ist die letzte Aktualisierung, die er gesendet hat.`,
    alerted: (name: string) => `${name} hat sich nicht zurückgemeldet. Barry hat Alarm geschlagen.`,
    checkedIn: (name: string, at: Date) => `${name} hat sich am ${formatWhenGerman(at)} zurückgemeldet.`,
    lastKnownPosition: (p: Position | null) =>
      p
        ? `Letzter bekannter Standort am ${formatWhenGerman(p.takenAt)}: ${position(p)}` +
          (p.accuracyM === null ? '' : ` (auf ${Math.round(p.accuracyM)} m genau)`)
        : 'Letzter bekannter Standort: nicht erfasst',
    plan: 'Plan',
    destination: 'Ziel',
    route: 'Route',
    linkFailed: 'Dieser Link hat nicht funktioniert',
    newLink: 'Öffne Barry und tippe nochmals auf «Konto erstellen», um einen neuen Link zu erhalten.',
    emailConfirmed: 'Deine E-Mail-Adresse ist bestätigt',
    welcome: 'Willkommen bei Barry. Allein los, sicher heim.',
    signInHint: 'Öffne Barry auf deinem iPhone und melde dich mit deiner E-Mail-Adresse und deinem Passwort an.',
    openBarry: 'Barry öffnen und anmelden',
  },
} satisfies Record<SiteLanguage, Record<string, unknown>>;
