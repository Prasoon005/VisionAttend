'use client';

import { ScanFace } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/auth/route-access';
import { isActive, navItemsFor } from './nav-items';

/** Desktop navigation (md and up). On phones the bottom bar takes over. */
export function Sidebar({ role }: { role: Role | null }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground md:flex">
      <Link href="/" className="flex h-16 items-center gap-2 px-6 text-lg font-semibold">
        <ScanFace aria-hidden className="size-7 text-primary" />
        VisionAttend
      </Link>
      <nav aria-label={t('mainNavigation')} data-testid="sidebar-nav" className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItemsFor(role).map(({ href, labelKey, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
