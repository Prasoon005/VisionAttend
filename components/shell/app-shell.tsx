import { ScanFace } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/lib/auth/session';
import { BottomNav } from './bottom-nav';
import { LanguageSwitcher } from './language-switcher';
import { NotificationsBell } from './notifications-bell';
import { ProfileMenu } from './profile-menu';
import { Sidebar } from './sidebar';
import { ThemeToggle } from './theme-toggle';

/**
 * Responsive frame around every page: sidebar on desktop, bottom bar on
 * phones, and a top bar with language, theme, notifications and profile.
 * Uses logical properties (border-e, ms-auto…) so it mirrors for RTL.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('Nav');
  const session = await getSession();
  const user = session.status === 'active' ? session.user : null;
  const role = user?.role ?? null;

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('skipToContent')}
      </a>
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-1 border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold md:hidden">
            <ScanFace aria-hidden className="size-6 text-primary" />
            VisionAttend
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationsBell />
            <ProfileMenu
              profile={user && { fullName: user.fullName, email: user.email, role: user.role }}
            />
          </div>
        </header>
        {/* Bottom padding keeps content clear of the fixed mobile bottom bar. */}
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav role={role} />
    </div>
  );
}
