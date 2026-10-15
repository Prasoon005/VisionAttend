/**
 * Who may open which page. Pure functions (no I/O) so they are unit-tested and
 * shared by proxy.ts (sign-in gate) and server layouts (role gate).
 * All paths here are WITHOUT the locale prefix, e.g. "/admin/users".
 */

export type Role = 'super_admin' | 'org_admin' | 'manager' | 'member';

export const ORG_ROLES: readonly Role[] = ['org_admin', 'manager', 'member'];

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  super_admin: '/platform',
  org_admin: '/admin',
  manager: '/dashboard',
  member: '/dashboard',
};

/** Sign-in pages: open to everyone, but signed-in users are sent home instead. */
const GUEST_ONLY = ['/login', '/admin/login', '/forgot-password'];

/**
 * Areas that need a session, and which roles may enter. Order matters: the
 * first matching prefix wins (so "/admin/login" above is checked first).
 */
const PROTECTED: readonly { prefix: string; roles: readonly Role[] }[] = [
  { prefix: '/platform', roles: ['super_admin'] },
  { prefix: '/admin', roles: ['org_admin'] },
  { prefix: '/dashboard', roles: ORG_ROLES },
  { prefix: '/settings', roles: ['super_admin', ...ORG_ROLES] },
];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function isGuestOnly(pathname: string): boolean {
  return GUEST_ONLY.some((path) => matches(pathname, path));
}

/** The roles allowed on this path, or null if the path is public. */
export function requiredRoles(pathname: string): readonly Role[] | null {
  if (isGuestOnly(pathname)) return null;
  return PROTECTED.find(({ prefix }) => matches(pathname, prefix))?.roles ?? null;
}

export function isProtected(pathname: string): boolean {
  return requiredRoles(pathname) !== null;
}

export function canAccess(role: Role, pathname: string): boolean {
  const roles = requiredRoles(pathname);
  return roles === null || roles.includes(role);
}

/**
 * Validates a post-login "next" target so it can only point inside this app.
 * Rejects absolute URLs, protocol-relative "//evil.com" and backslash tricks
 * (open-redirect protection). Returns a locale-free path or null.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  try {
    const url = new URL(next, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
