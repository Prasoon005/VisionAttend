import {
  Building2,
  House,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Messages } from 'next-intl';
import { ORG_ROLES, type Role } from '@/lib/auth/route-access';

export interface NavItem {
  href: '/' | '/dashboard' | '/admin' | '/platform' | '/design-system';
  /** Key under the "Nav" namespace in messages/*.json. */
  labelKey: keyof Messages['Nav'];
  icon: LucideIcon;
  /** Roles that see this entry; omitted = everyone, including signed-out visitors. */
  roles?: readonly Role[];
}

/** Primary navigation, shared by the desktop sidebar and the mobile bottom bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', labelKey: 'home', icon: House },
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ORG_ROLES },
  { href: '/admin', labelKey: 'admin', icon: ShieldCheck, roles: ['org_admin'] },
  { href: '/platform', labelKey: 'platform', icon: Building2, roles: ['super_admin'] },
  { href: '/design-system', labelKey: 'designSystem', icon: Palette },
];

/** Entries visible to this role (null = signed out). Hiding is UX only; access is enforced server-side. */
export function navItemsFor(role: Role | null): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));
}

/** "/" only matches exactly; other items also match their sub-pages. */
export function isActive(pathname: string, href: NavItem['href']): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
