import { ScanFace } from 'lucide-react';
import { Link, Outlet } from 'react-router';

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ScanFace aria-hidden className="size-6 text-indigo-600 dark:text-indigo-400" />
            VisionAttend
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
