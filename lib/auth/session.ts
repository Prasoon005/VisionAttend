import 'server-only';
import { getLocale } from 'next-intl/server';
import { cache } from 'react';
import { redirect } from '@/i18n/navigation';
import { ROLE_HOME, type Role } from '@/lib/auth/route-access';
import { createClient } from '@/lib/supabase/server';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  departmentName: string | null;
}

export type SessionState =
  | { status: 'signed-out' }
  /** Signed in, but deactivated, deleted, or their organization is suspended. */
  | { status: 'inactive' }
  | { status: 'active'; user: CurrentUser };

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: 'active' | 'deactivated';
  deleted_at: string | null;
  org_id: string | null;
  organizations: { name: string; status: 'active' | 'suspended' } | null;
  departments: { name: string } | null;
}

/**
 * The signed-in user and their live profile, read once per request (React
 * `cache`). Reads go through RLS as the user, so a suspended organization is
 * simply not visible and the user counts as inactive.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'signed-out' };

  const { data } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, status, deleted_at, org_id, organizations(name, status), departments(name)',
    )
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  const orgActive = data?.role === 'super_admin' || data?.organizations?.status === 'active';
  if (!data || data.status !== 'active' || data.deleted_at || !orgActive) {
    return { status: 'inactive' };
  }

  return {
    status: 'active',
    user: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      orgId: data.org_id,
      orgName: data.organizations?.name ?? null,
      departmentName: data.departments?.name ?? null,
    },
  };
});

/**
 * Guards a protected area (call from its layout or page). Signed-out visitors
 * go to sign-in, inactive accounts to sign-in with an explanation, and users
 * with the wrong role to their own home page.
 */
export async function requireRole(roles: readonly Role[]): Promise<CurrentUser> {
  const locale = await getLocale();
  const session = await getSession();

  if (session.status === 'signed-out') {
    return redirect({ href: '/login', locale });
  }
  if (session.status === 'inactive') {
    return redirect({ href: { pathname: '/login', query: { error: 'account_inactive' } }, locale });
  }
  if (!roles.includes(session.user.role)) {
    return redirect({ href: ROLE_HOME[session.user.role], locale });
  }
  return session.user;
}
