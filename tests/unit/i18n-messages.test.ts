import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n/locales';
import en from '@/messages/en.json';
import hi from '@/messages/hi.json';

const ALL: Record<string, unknown> = { en, hi };

/** Flattens nested messages to { "Nav.home": "Home", … }. */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, child]) => ({ ...acc, ...flatten(child, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translation files', () => {
  const reference = flatten(en);

  it('exist for every supported locale', () => {
    expect(Object.keys(ALL).sort()).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES.filter((l) => l !== 'en'))(
    '%s has exactly the same keys as English',
    (locale) => {
      expect(Object.keys(flatten(ALL[locale])).sort()).toEqual(Object.keys(reference).sort());
    },
  );

  it.each(LOCALES)('%s has no empty strings', (locale) => {
    const empty = Object.entries(flatten(ALL[locale])).filter(([, text]) => !text.trim());
    expect(empty).toEqual([]);
  });

  it.each(LOCALES)('%s keeps the same {placeholders} as English', (locale) => {
    const messages = flatten(ALL[locale]);
    for (const [key, text] of Object.entries(reference)) {
      expect(placeholders(messages[key] ?? ''), key).toEqual(placeholders(text));
    }
  });
});
