/**
 * Supported locales. Adding a language = add it here + a messages/<code>.json
 * file with the same keys (a unit test enforces key parity).
 */
export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export type Direction = 'ltr' | 'rtl';

export const LOCALE_META: Record<
  Locale,
  { nativeName: string; englishName: string; dir: Direction }
> = {
  en: { nativeName: 'English', englishName: 'English', dir: 'ltr' },
  hi: { nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
};

export function directionOf(locale: Locale): Direction {
  return LOCALE_META[locale].dir;
}
