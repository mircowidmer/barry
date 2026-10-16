import { getLocales, useLocales } from 'expo-localization';

export type AppLanguage = 'en' | 'de';

const pick = (languageCode: string | null | undefined): AppLanguage => (languageCode === 'de' ? 'de' : 'en');

/** German when the phone's first language is German, English otherwise. For code outside components. */
export const appLanguage = (): AppLanguage => pick(getLocales()[0]?.languageCode);

/** Like appLanguage, and renders again when the language changes in Settings. */
export const useAppLanguage = (): AppLanguage => pick(useLocales()[0]?.languageCode);
