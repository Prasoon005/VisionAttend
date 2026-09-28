import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Permission } from '@visionattend/shared';
import { useAuth } from './AuthProvider';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <LoaderCircle aria-hidden className="size-6 animate-spin text-indigo-600" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Only signed-in users get through. Users with a generated password are sent
 * to change it first, mirroring the API's PASSWORD_CHANGE_REQUIRED rule.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <FullPageSpinner />;
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (auth.user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

/** Hides pages the user has no permission for (the API enforces it anyway). */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user?.permissions.includes(permission)) return <Navigate to="/" replace />;
  return children;
}

/**
 * The login page is pointless when already signed in. After a successful
 * login this also sends the user back to the page they originally wanted.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <FullPageSpinner />;
  if (auth.status === 'authenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={typeof from === 'string' ? from : '/'} replace />;
  }
  return children;
}
