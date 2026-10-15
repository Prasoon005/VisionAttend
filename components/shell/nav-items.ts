import { House, Palette, type LucideIcon } from 'lucide-react';
import type { Messages } from 'next-intl';

export interface NavItem {
  href: '/' | '/design-system';
  /** Key under the "Nav" namespace in messages/*.json. */
  labelKey: keyof Messages['Nav'];
  icon: LucideIcon;
}

/**
 * Primary navigation, shared by the desktop sidebar and the mobile bottom
 * bar. Later phases add role-filtered entries here (attendance, admin…).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', labelKey: 'home', icon: House },
  { href: '/design-system', labelKey: 'designSystem', icon: Palette },
];

/** "/" only matches exactly; other items also match their sub-pages. */
export function isActive(pathname: string, href: NavItem['href']): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
