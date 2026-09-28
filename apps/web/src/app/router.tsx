import { createBrowserRouter, Link } from 'react-router';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
import { RedirectIfAuthenticated, RequireAuth, RequirePermission } from '../features/auth/guards';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/home/HomePage';
import { OrganizationsPage } from '../features/organizations/OrganizationsPage';
import { SystemStatusPage } from '../features/system-status/SystemStatusPage';
import { AppLayout } from './AppLayout';

function NotFoundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-indigo-600 hover:underline dark:text-indigo-400">
        Back to home
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'change-password', element: <ChangePasswordPage /> },
      {
        path: 'platform/organizations',
        element: (
          <RequirePermission permission="organization:manage">
            <OrganizationsPage />
          </RequirePermission>
        ),
      },
      {
        path: 'status',
        element: (
          <RequirePermission permission="platform:health">
            <SystemStatusPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
