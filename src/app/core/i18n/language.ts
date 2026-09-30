export const APP_LANGS = ['de', 'en'] as const;
export type AppLang = (typeof APP_LANGS)[number];
export const FALLBACK_LANG: AppLang = 'en';

/** Picks the app language from a BCP 47 tag such as `de-CH`; unknown languages fall back to English. */
export function detectLanguage(tag: string | undefined | null): AppLang {
  const base = tag?.toLowerCase().split('-')[0];
  return APP_LANGS.find((lang) => lang === base) ?? FALLBACK_LANG;
}
