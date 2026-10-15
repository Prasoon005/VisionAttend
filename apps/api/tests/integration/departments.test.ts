import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { departmentListResponseSchema, departmentSchema } from '@visionattend/shared';
import { buildTestApp } from '../helpers/test-app.js';
import { createOrganization, createUser, PASSWORD, prisma, resetDatabase } from './harness.js';

const app = buildTestApp({ prisma });

let orgA: string;
let tokenA: string;
let tokenB: string;
let employeeToken: string;

async function tokenFor(email: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return res.body.accessToken as string;
}

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path: string, body: object) =>
    request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path: string) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
});

beforeEach(async () => {
  await resetDatabase();
  orgA = (await createOrganization('tenant-a')).id;
  const orgB = (await createOrganization('tenant-b')).id;
  await createUser('admin@a.example.test', 'ORG_ADMIN', orgA);
  await createUser('admin@b.example.test', 'ORG_ADMIN', orgB);
  await createUser('staff@a.example.test', 'EMPLOYEE', orgA);
  tokenA = await tokenFor('admin@a.example.test');
  tokenB = await tokenFor('admin@b.example.test');
  employeeToken = await tokenFor('staff@a.example.test');
});

afterAll(() => prisma.$disconnect());

describe('departments', () => {
  it('creates, lists (sorted by name), updates and deletes, auditing each change', async () => {
    const created = departmentSchema.parse(
      (
        await as(tokenA)
          .post('/api/v1/departments', { name: 'Engineering', code: 'eng' })
          .expect(201)
      ).body,
    );
    expect(created).toMatchObject({ name: 'Engineering', code: 'ENG', employeeCount: 0 });
    await as(tokenA).post('/api/v1/departments', { name: 'Accounts' }).expect(201);

    const list = departmentListResponseSchema.parse(
      (await as(tokenA).get('/api/v1/departments').expect(200)).body,
    );
    expect(list.items.map(({ name }) => name)).toEqual(['Accounts', 'Engineering']);

    const updated = await as(tokenA)
      .patch(`/api/v1/departments/${created.id}`, { name: 'R&D', code: '' })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'R&D', code: null });

    await as(tokenA).delete(`/api/v1/departments/${created.id}`).expect(204);

    const actions = await prisma.auditLog.findMany({
      where: { entityId: created.id },
      orderBy: { createdAt: 'asc' },
      select: { action: true, organizationId: true },
    });
    expect(actions).toEqual([
      { action: 'department.create', organizationId: orgA },
      { action: 'department.update', organizationId: orgA },
      { action: 'department.delete', organizationId: orgA },
    ]);
  });

  it('rejects a duplicate name in the same organization but allows it in another', async () => {
    await as(tokenA).post('/api/v1/departments', { name: 'Sales' }).expect(201);
    const res = await as(tokenA).post('/api/v1/departments', { name: 'Sales' }).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
    await as(tokenB).post('/api/v1/departments', { name: 'Sales' }).expect(201);
  });

  it('validates input', async () => {
    const res = await as(tokenA)
      .post('/api/v1/departments', { name: 'X', code: 'bad code!' })
      .expect(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'code',
      'name',
    ]);
  });

  it('refuses to delete a department that still has employees', async () => {
    const { body } = await as(tokenA).post('/api/v1/departments', { name: 'Ops' }).expect(201);
    await prisma.employee.create({
      data: {
        organizationId: orgA,
        employeeCode: 'E001',
        firstName: 'Asha',
        lastName: 'Rao',
        joinedOn: new Date('2026-01-01'),
        departmentId: body.id,
      },
    });

    const res = await as(tokenA).delete(`/api/v1/departments/${body.id}`).expect(409);
    expect(res.body.error.details).toEqual({ employeeCount: 1 });
    expect(await prisma.department.count({ where: { id: body.id } })).toBe(1);
  });

  it('hides other tenants’ departments: list excludes them, update/delete answer 404', async () => {
    const { body } = await as(tokenA).post('/api/v1/departments', { name: 'Secret' }).expect(201);

    const listB = departmentListResponseSchema.parse(
      (await as(tokenB).get('/api/v1/departments').expect(200)).body,
    );
    expect(listB.items).toEqual([]);

    await as(tokenB).patch(`/api/v1/departments/${body.id}`, { name: 'Hijacked' }).expect(404);
    await as(tokenB).delete(`/api/v1/departments/${body.id}`).expect(404);
    expect((await prisma.department.findUniqueOrThrow({ where: { id: body.id } })).name).toBe(
      'Secret',
    );
  });

  it('forbids employees from reading or changing departments', async () => {
    await as(employeeToken).get('/api/v1/departments').expect(403);
    await as(employeeToken).post('/api/v1/departments', { name: 'Mine' }).expect(403);
  });
});
