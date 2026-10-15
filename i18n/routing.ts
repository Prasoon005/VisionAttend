import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from './locales';

/**
 * Every page lives under /<locale>/… (e.g. /en, /hi/design-system). An
 * always-present prefix makes URLs shareable in a specific language and keeps
 * caching per locale simple.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
