/**
 * Development seed: a synthetic demo organization.
 *
 * All data here is fictional (example.test is a reserved domain). Never seed
 * real employee data. User accounts are added in Phase 2 together with
 * password hashing.
 */
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createPrismaClient } from '../src/lib/prisma.js';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run the development seed with NODE_ENV=production');
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const prisma = createPrismaClient(databaseUrl);

async function seed() {
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

  for (let i = 1; i <= 5; i++) {
    const code = `EMP${String(i).padStart(3, '0')}`;
    await prisma.employee.upsert({
      where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: code } },
      update: {},
      create: {
        organizationId: org.id,
        employeeCode: code,
        firstName: 'Employee',
        lastName: String(i).padStart(3, '0'),
        workEmail: `employee${String(i).padStart(3, '0')}@example.test`,
        departmentId: engineering?.id ?? null,
        defaultShiftId: generalShift.id,
        joinedOn: new Date('2026-01-01'),
      },
    });
  }

  console.log(`Seeded demo organization "${org.slug}" with 5 synthetic employees.`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
