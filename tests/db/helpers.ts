import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Role = 'super_admin' | 'org_admin' | 'manager' | 'member';

export const PASSWORD = 'Test-Passw0rd-123';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see tests/db/global-setup.ts)`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service-role client: bypasses RLS. Used only to arrange test data. */
export const admin: SupabaseClient = createClient(
  env('TEST_SUPABASE_URL'),
  env('TEST_SUPABASE_SECRET_KEY'),
  noSession,
);

/** A client with no session, like a visitor who is not signed in. */
export function anonymousClient(): SupabaseClient {
  return createClient(env('TEST_SUPABASE_URL'), env('TEST_SUPABASE_PUBLISHABLE_KEY'), noSession);
}

const unique = () => randomUUID().slice(0, 8);

export async function createOrg(label = 'org'): Promise<string> {
  const { data, error } = await admin
    .from('organizations')
    .insert({ name: `Test ${label}`, slug: `t-${label}-${unique()}`, timezone: 'Asia/Kolkata' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createDepartment(orgId: string, name = `Dept ${unique()}`): Promise<string> {
  const { data, error } = await admin
    .from('departments')
    .insert({ org_id: orgId, name })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** The Super Admin exists only through supabase/seed.sql (direct SQL), never via the API. */
const SEEDED_SUPER_ADMIN = { email: 'superadmin@visionattend.test', password: 'Demo@12345' };

/**
 * Creates a signed-in user. Organization users go through a real invitation,
 * exactly like production (the API cannot create uninvited users); the Super
 * Admin is the seeded one.
 */
export async function createUser(
  role: Role,
  orgId: string | null,
  options: { departmentId?: string } = {},
): Promise<TestUser> {
  if (role === 'super_admin') {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('email', SEEDED_SUPER_ADMIN.email)
      .single();
    if (!data) throw new Error('Seeded super admin missing: run `npx supabase db reset`.');
    return {
      id: data.id as string,
      email: SEEDED_SUPER_ADMIN.email,
      client: await signIn(SEEDED_SUPER_ADMIN.email, SEEDED_SUPER_ADMIN.password),
    };
  }
  if (!orgId) throw new Error(`${role} needs an organization`);

  const email = `${role.replace('_', '-')}-${unique()}@example.test`;
  const invite = await createInvite({ orgId, role, email, departmentId: options.departmentId });
  const { data, error } = await signUpWithInvite(email, invite.token);
  if (error) throw error;
  return { id: data.user!.id, email, client: await signIn(email) };
}

export async function signIn(email: string, password = PASSWORD): Promise<SupabaseClient> {
  const client = anonymousClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Inserts an invite (as the service role) and returns its plaintext token. */
export async function createInvite(options: {
  orgId: string;
  role: Exclude<Role, 'super_admin'>;
  email?: string;
  departmentId?: string;
  maxUses?: number;
  expiresAt?: Date;
  revoked?: boolean;
}): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString('base64url');
  const { data, error } = await admin
    .from('invites')
    .insert({
      org_id: options.orgId,
      role: options.role,
      email: options.email ?? null,
      department_id: options.departmentId ?? null,
      token_hash: hashToken(token),
      max_uses: options.maxUses ?? 1,
      expires_at: (options.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
      revoked_at: options.revoked ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string, token };
}

/** Tries to create a login with an invite token, the way the invite flow will. */
export function signUpWithInvite(email: string, token: string) {
  return admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { invite_token: token, full_name: 'Invited Person' },
  });
}

export const randomEmail = (prefix = 'user') => `${prefix}-${unique()}@example.test`;
