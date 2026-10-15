import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, directionOf, LOCALE_META, LOCALES } from '@/i18n/locales';
import { routing } from '@/i18n/routing';

describe('locale configuration', () => {
  it('includes the default locale among the supported ones', () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
    expect(routing.defaultLocale).toBe(DEFAULT_LOCALE);
  });

  it('describes every locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_META[locale].nativeName).not.toBe('');
      expect(['ltr', 'rtl']).toContain(directionOf(locale));
    }
  });

  it('starts with English and Hindi, both left to right', () => {
    expect([...LOCALES]).toEqual(['en', 'hi']);
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('hi')).toBe('ltr');
  });

  it('always prefixes URLs with the locale', () => {
    expect(routing.localePrefix).toBe('always');
  });
});
