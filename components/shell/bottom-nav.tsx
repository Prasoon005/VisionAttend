'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { isActive, NAV_ITEMS } from './nav-items';

/**
 * Phone navigation: fixed to the bottom, within thumb reach, padded for the
 * iOS home indicator (safe-area inset). Hidden from md upwards.
 */
export function BottomNav() {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('mainNavigation')}
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    transition={transitions.spring}
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-primary"
                  />
                )}
                <Icon aria-hidden className="size-5" />
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
