import { describe, expect, it } from 'vitest';
import { isActive, NAV_ITEMS } from '@/components/shell/nav-items';
import en from '@/messages/en.json';

describe('navigation', () => {
  it('matches Home only on the exact root path', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/design-system', '/')).toBe(false);
  });

  it('matches a section and its sub-pages, but not look-alike paths', () => {
    expect(isActive('/design-system', '/design-system')).toBe(true);
    expect(isActive('/design-system/colors', '/design-system')).toBe(true);
    expect(isActive('/design-systems', '/design-system')).toBe(false);
  });

  it('has a translated label for every item', () => {
    for (const item of NAV_ITEMS) expect(en.Nav[item.labelKey]).toBeTruthy();
  });
});
