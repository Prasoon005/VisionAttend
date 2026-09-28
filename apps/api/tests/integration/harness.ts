import type { Role } from '@visionattend/shared';
import type { Response } from 'supertest';
import { createPrismaClient, type PrismaClient } from '../../src/lib/prisma.js';
import { hashPassword } from '../../src/lib/password.js';
import { REFRESH_COOKIE } from '../../src/modules/auth/auth.routes.js';
import { testDatabaseUrl } from './test-env.js';

export const prisma: PrismaClient = createPrismaClient(testDatabaseUrl());

export const PASSWORD = 'integration-test-password';

/** Wipes every table (CASCADE follows the foreign keys). */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

let hashed: Promise<string> | undefined;

export async function createOrganization(slug: string) {
  return prisma.organization.create({
    data: { name: `Org ${slug}`, slug, timezone: 'Asia/Kolkata' },
  });
}

export async function createUser(
  email: string,
  role: Role,
  organizationId: string | null,
  extra: { mustChangePassword?: boolean } = {},
) {
  hashed ??= hashPassword(PASSWORD);
  return prisma.user.create({
    data: { email, role, organizationId, passwordHash: await hashed, ...extra },
  });
}

/** The refresh token from a response's Set-Cookie header. */
export function refreshCookieFrom(res: Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith(`${REFRESH_COOKIE}=`));
  const token = cookie?.split(';')[0]?.slice(REFRESH_COOKIE.length + 1);
  if (!token) throw new Error('response did not set a refresh cookie');
  return token;
}

export const asCookie = (token: string) => `${REFRESH_COOKIE}=${token}`;
