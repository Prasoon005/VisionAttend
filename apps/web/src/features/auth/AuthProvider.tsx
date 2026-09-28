import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser, Permission } from '@visionattend/shared';
import { onSessionChange, refreshSession } from '../../lib/api/client';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: AuthUser };

const AuthContext = createContext<AuthState | null>(null);

/**
 * Tracks who is signed in. On start-up it tries the refresh cookie once, so a
 * page reload keeps the user signed in without the token ever being stored.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      if (session) {
        setState({ status: 'authenticated', user: session.user });
      } else {
        setState({ status: 'anonymous', user: null });
        // Never show the previous user's cached data to the next one.
        queryClient.clear();
      }
    });
    refreshSession().catch(() => undefined); // no session: the listener sets "anonymous"
    return unsubscribe;
  }, [queryClient]);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>');
  return state;
}

/** UI hint only: the API enforces every permission again on the server. */
export function useCan(): (permission: Permission) => boolean {
  const { user } = useAuth();
  return (permission) => user?.permissions.includes(permission) ?? false;
}
