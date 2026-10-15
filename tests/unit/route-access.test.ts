import { describe, expect, it } from 'vitest';
import {
  canAccess,
  isGuestOnly,
  isProtected,
  requiredRoles,
  ROLE_HOME,
  safeNextPath,
  type Role,
} from '@/lib/auth/route-access';

const ALL_ROLES: Role[] = ['super_admin', 'org_admin', 'manager', 'member'];

describe('route access', () => {
  it.each(['/', '/design-system', '/login', '/admin/login', '/forgot-password'])(
    '%s is public',
    (path) => {
      expect(isProtected(path)).toBe(false);
      for (const role of ALL_ROLES) expect(canAccess(role, path)).toBe(true);
    },
  );

  it.each([
    '/dashboard',
    '/settings',
    '/admin',
    '/admin/users',
    '/platform',
    '/platform/organizations',
  ])('%s needs a session', (path) => expect(isProtected(path)).toBe(true));

  it('keeps the admin sign-in page public although it lives under /admin', () => {
    expect(isGuestOnly('/admin/login')).toBe(true);
    expect(requiredRoles('/admin/login')).toBeNull();
    expect(requiredRoles('/admin/users')).toEqual(['org_admin']);
  });

  it('does not treat look-alike paths as protected areas', () => {
    expect(isProtected('/administrator')).toBe(false);
    expect(isProtected('/dashboards')).toBe(false);
  });

  it('lets only the super admin into /platform', () => {
    expect(ALL_ROLES.filter((role) => canAccess(role, '/platform'))).toEqual(['super_admin']);
  });

  it('lets only org admins into /admin', () => {
    expect(ALL_ROLES.filter((role) => canAccess(role, '/admin/users'))).toEqual(['org_admin']);
  });

  it('keeps the super admin out of the member dashboard', () => {
    expect(canAccess('super_admin', '/dashboard')).toBe(false);
    expect(canAccess('member', '/dashboard')).toBe(true);
  });

  it('sends every role home to a page that role may open', () => {
    for (const role of ALL_ROLES) expect(canAccess(role, ROLE_HOME[role])).toBe(true);
  });
});

describe('safeNextPath (open-redirect protection)', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/admin/users?page=2', '/admin/users?page=2'],
  ])('accepts the internal path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'dashboard',
    '',
    null,
    undefined,
  ])('rejects %s', (input) => {
    expect(safeNextPath(input)).toBeNull();
  });
});
