import { useEffect, useSyncExternalStore } from 'react';

import type { LastKnown } from '@/lib/trail-map/types';
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

type Position = LastKnown;

export const siteText = {
  en: {
    logo: "Barry's icon, a St. Bernard with a little barrel on its collar",
    adventure: 'Adventure',
    lastKnown: (at: Date) => `Last position, ${formatWhen(at)}`,
    loading: 'Loading…',
    linkBroken: 'This link does not work.',
    unreachable: 'Barry cannot be reached. Try again in a moment.',
    adventureOf: (name: string) => `${name}'s Adventure`,
    updatesEveryFiveMinutes: 'Barry updates this map every 5 minutes.',
    staleSince: (since: Date) => `Barry cannot be reached since ${formatWhen(since)}. This is the last update it sent.`,
    alerted: (name: string) => `${name} has not checked in. Barry has raised the alert.`,
    checkedIn: (name: string, at: Date) => `${name} checked in on ${formatWhen(at)}.`,
    lastKnownPosition: (p: Position | null) =>
      p
        ? `Last position on ${formatWhen(p.takenAt)}: ${position(p)}` + (p.accuracyM === null ? '' : ` (within ${Math.round(p.accuracyM)} m)`)
        : 'Last position: not recorded',
    plan: 'Plan',
    destination: 'Destination',
    linkFailed: 'This link did not work',
    linkExpired: 'The link has expired or was already used.',
    linkInvalid: 'Barry could not confirm it.',
    newLink: 'Open Barry and tap Create Account again to get a new link.',
    emailConfirmed: 'Your email is confirmed',
    welcome: 'Welcome to Barry. Go alone, get home.',
    signInHint: 'Go back to Barry on your iPhone. It signs you in by itself, or asks for your email address and password.',
    openBarry: 'Open Barry and sign in',
    oneMoreLink: 'One more link to open',
    otherAddress: 'Barry also sent a link to your other email address. Your address changes once you open that one too.',
    emailChanged: 'Your email address is changed',
    signInWithNew: 'From now on, sign in to Barry with your new address and your password.',
    staysSignedIn: 'Barry on your iPhone stays signed in.',
  },
  de: {
    logo: 'Barrys Symbol, ein Bernhardiner mit einem kleinen Fässchen am Halsband',
    adventure: 'Abenteuer',
    lastKnown: (at: Date) => `Letzter Standort, ${formatWhenGerman(at)}`,
    loading: 'Wird geladen…',
    linkBroken: 'Dieser Link funktioniert nicht.',
    unreachable: 'Barry ist nicht erreichbar. Versuch es gleich nochmals.',
    adventureOf: (name: string) => (/[sxzß]$/i.test(name) ? `${name}’ Abenteuer` : `${name}s Abenteuer`),
    updatesEveryFiveMinutes: 'Barry aktualisiert diese Karte alle 5 Minuten.',
    staleSince: (since: Date) =>
      `Barry ist seit ${formatWhenGerman(since)} nicht erreichbar. Das ist die letzte Aktualisierung, die er gesendet hat.`,
    alerted: (name: string) => `${name} hat sich nicht zurückgemeldet. Barry hat Alarm geschlagen.`,
    checkedIn: (name: string, at: Date) => `${name} hat sich am ${formatWhenGerman(at)} zurückgemeldet.`,
    lastKnownPosition: (p: Position | null) =>
      p
        ? `Letzter Standort am ${formatWhenGerman(p.takenAt)}: ${position(p)}` +
          (p.accuracyM === null ? '' : ` (auf ${Math.round(p.accuracyM)} m genau)`)
        : 'Letzter Standort: nicht erfasst',
    plan: 'Plan',
    destination: 'Ziel',
    linkFailed: 'Dieser Link hat nicht funktioniert',
    linkExpired: 'Der Link ist abgelaufen oder wurde schon verwendet.',
    linkInvalid: 'Barry konnte ihn nicht bestätigen.',
    newLink: 'Öffne Barry und tippe nochmals auf «Konto erstellen», um einen neuen Link zu erhalten.',
    emailConfirmed: 'Deine E-Mail-Adresse ist bestätigt',
    welcome: 'Willkommen bei Barry. Allein los, sicher heim.',
    signInHint: 'Geh zurück zu Barry auf deinem iPhone. Barry meldet dich von selbst an oder fragt nach deiner E-Mail-Adresse und deinem Passwort.',
    openBarry: 'Barry öffnen und anmelden',
    oneMoreLink: 'Noch ein Link',
    otherAddress: 'Barry hat auch einen Link an deine andere E-Mail-Adresse geschickt. Deine Adresse ändert sich, sobald du auch diesen öffnest.',
    emailChanged: 'Deine E-Mail-Adresse ist geändert',
    signInWithNew: 'Ab jetzt meldest du dich bei Barry mit deiner neuen Adresse und deinem Passwort an.',
    staysSignedIn: 'Auf deinem iPhone bleibst du bei Barry angemeldet.',
  },
} satisfies Record<SiteLanguage, Record<string, unknown>>;
