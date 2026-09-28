import { LogOut, ScanFace } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import type { Permission } from '@visionattend/shared';
import { logout } from '../features/auth/api';
import { useAuth, useCan } from '../features/auth/AuthProvider';

const NAV: { to: string; label: string; permission?: Permission }[] = [
  { to: '/', label: 'Home' },
  { to: '/platform/organizations', label: 'Organizations', permission: 'organization:manage' },
  { to: '/status', label: 'System status', permission: 'platform:health' },
  { to: '/change-password', label: 'Password' },
];

export function AppLayout() {
  const { user } = useAuth();
  const can = useCan();
  const [signingOut, setSigningOut] = useState(false);
  // While a generated password is pending, only the change-password page is usable.
  const locked = user?.mustChangePassword ?? false;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ScanFace aria-hidden className="size-6 text-indigo-600 dark:text-indigo-400" />
            VisionAttend
          </Link>
          {!locked && (
            <nav className="hidden gap-4 text-sm sm:flex">
              {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    isActive
                      ? 'font-medium text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 md:inline">{user?.email}</span>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                logout().finally(() => setSigningOut(false));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
