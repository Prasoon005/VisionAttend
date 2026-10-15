import { describe, expect, it } from 'vitest';
import { isActive, NAV_ITEMS, navItemsFor } from '@/components/shell/nav-items';
import { canAccess } from '@/lib/auth/route-access';
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

  it('shows signed-out visitors only public entries', () => {
    expect(navItemsFor(null).map((item) => item.href)).toEqual(['/', '/design-system']);
  });

  it('shows each role the areas it works in', () => {
    const hrefs = (role: Parameters<typeof navItemsFor>[0]) =>
      navItemsFor(role).map((item) => item.href);
    expect(hrefs('member')).toEqual(['/', '/dashboard', '/design-system']);
    expect(hrefs('org_admin')).toEqual(['/', '/dashboard', '/admin', '/design-system']);
    expect(hrefs('super_admin')).toEqual(['/', '/platform', '/design-system']);
  });

  it('never shows a role a link it cannot open', () => {
    for (const role of ['super_admin', 'org_admin', 'manager', 'member'] as const) {
      for (const item of navItemsFor(role)) expect(canAccess(role, item.href)).toBe(true);
    }
  });
});
