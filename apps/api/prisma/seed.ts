/**
 * Development seed: a synthetic demo organization.
 *
 * All data here is fictional (example.test is a reserved domain). Never seed
 * real employee data. Demo logins share one password taken from
 * SEED_USER_PASSWORD in .env, so no password is ever committed.
 */
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { hashPassword } from '../src/lib/password.js';
import { createPrismaClient } from '../src/lib/prisma.js';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the development seed with NODE_ENV=production');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const seedPassword = process.env.SEED_USER_PASSWORD ?? '';
if (seedPassword.length < 12 || seedPassword.includes('replace_with')) {
  throw new Error('Set SEED_USER_PASSWORD in .env (at least 12 characters, not the placeholder)');
}

const prisma = createPrismaClient(databaseUrl);

async function seed() {
  const passwordHash = await hashPassword(seedPassword);
  // Re-running the seed resets the demo passwords and clears any lockout.
  const upsertUser = (
    email: string,
    role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'EMPLOYEE',
    organizationId: string | null,
  ) =>
    prisma.user.upsert({
      where: { email },
      update: { passwordHash, failedLoginCount: 0, lockedUntil: null, status: 'ACTIVE' },
      create: { email, role, organizationId, passwordHash },
    });

  await upsertUser('superadmin@example.test', 'SUPER_ADMIN', null);

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Organization', slug: 'demo', timezone: 'Asia/Kolkata' },
  });

  const [engineering] = await Promise.all(
    ['Engineering', 'Human Resources'].map((name) =>
      prisma.department.upsert({
        where: { organizationId_name: { organizationId: org.id, name } },
        update: {},
        create: { organizationId: org.id, name },
      }),
    ),
  );

  const generalShift = await prisma.shift.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'General' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'General',
      startMinute: 9 * 60, // 09:00
      endMinute: 18 * 60, // 18:00
      graceMinutes: 10,
      halfDayMinutes: 4 * 60,
      fullDayMinutes: 8 * 60,
    },
  });

  await prisma.camera.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Main Entrance' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Main Entrance',
      location: 'Ground floor lobby',
      direction: 'ENTRY',
      sourceType: 'WEBCAM',
    },
  });

  await upsertUser('admin@demo.example.test', 'ORG_ADMIN', org.id);
  // Employee 001 can sign in to the self-service portal.
  const employeeUser = await upsertUser('employee001@example.test', 'EMPLOYEE', org.id);

  for (let i = 1; i <= 5; i++) {
    const code = `EMP${String(i).padStart(3, '0')}`;
    const userId = i === 1 ? employeeUser.id : null;
    await prisma.employee.upsert({
      where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: code } },
      update: { userId },
      create: {
        organizationId: org.id,
        employeeCode: code,
        firstName: 'Employee',
        lastName: String(i).padStart(3, '0'),
        workEmail: `employee${String(i).padStart(3, '0')}@example.test`,
        departmentId: engineering?.id ?? null,
        defaultShiftId: generalShift.id,
        joinedOn: new Date('2026-01-01'),
        userId,
      },
    });
  }

  console.log(`Seeded demo organization "${org.slug}" with 5 synthetic employees.`);
  console.log(
    'Logins (password = SEED_USER_PASSWORD): superadmin@example.test, admin@demo.example.test, employee001@example.test',
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
