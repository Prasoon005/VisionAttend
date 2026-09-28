import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLogListResponseSchema } from '@visionattend/shared';
import { buildTestApp } from '../helpers/test-app.js';
import { createOrganization, createUser, PASSWORD, prisma, resetDatabase } from './harness.js';

const app = buildTestApp({ prisma });

let tokenA: string;
let tokenB: string;
let orgA: string;
let orgB: string;

async function tokenFor(email: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return res.body.accessToken as string;
}

beforeAll(async () => {
  await resetDatabase();
  orgA = (await createOrganization('tenant-a')).id;
  orgB = (await createOrganization('tenant-b')).id;
  await createUser('admin@a.example.test', 'ORG_ADMIN', orgA);
  await createUser('admin@b.example.test', 'ORG_ADMIN', orgB);
  // Each login writes an audit entry into that admin's own organization.
  tokenA = await tokenFor('admin@a.example.test');
  tokenB = await tokenFor('admin@b.example.test');
});

afterAll(() => prisma.$disconnect());

const get = (path: string, token: string) =>
  request(app).get(path).set('Authorization', `Bearer ${token}`);

describe('tenant isolation', () => {
  it('lists only the caller’s own organization’s audit entries', async () => {
    const a = auditLogListResponseSchema.parse((await get('/api/v1/audit-logs', tokenA)).body);
    const b = auditLogListResponseSchema.parse((await get('/api/v1/audit-logs', tokenB)).body);

    expect(a.total).toBeGreaterThan(0);
    expect(b.total).toBeGreaterThan(0);
    const idsA = new Set(a.items.map(({ id }) => id));
    expect(b.items.some(({ id }) => idsA.has(id))).toBe(false);

    const orgsInA = await prisma.auditLog.findMany({
      where: { id: { in: [...idsA] } },
      select: { organizationId: true },
    });
    expect(orgsInA.every(({ organizationId }) => organizationId === orgA)).toBe(true);
  });

  it('answers 404 (not 403) for another tenant’s record, hiding that it exists', async () => {
    const entryOfA = await prisma.auditLog.findFirstOrThrow({ where: { organizationId: orgA } });

    await get(`/api/v1/audit-logs/${entryOfA.id}`, tokenA).expect(200);
    const res = await get(`/api/v1/audit-logs/${entryOfA.id}`, tokenB).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('ignores any organization supplied by the client', async () => {
    const res = await get(`/api/v1/audit-logs?organizationId=${orgA}`, tokenB).expect(200);
    const body = auditLogListResponseSchema.parse(res.body);
    const ids = body.items.map(({ id }) => id);
    const rows = await prisma.auditLog.findMany({ where: { id: { in: ids } } });
    expect(rows.every(({ organizationId }) => organizationId === orgB)).toBe(true);
  });

  it('the database itself rejects a cross-tenant employee–user link', async () => {
    const userOfB = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@b.example.test' },
    });
    await expect(
      prisma.employee.create({
        data: {
          organizationId: orgA,
          employeeCode: 'X001',
          firstName: 'Cross',
          lastName: 'Tenant',
          joinedOn: new Date('2026-01-01'),
          userId: userOfB.id,
        },
      }),
    ).rejects.toThrow();
  });
});
