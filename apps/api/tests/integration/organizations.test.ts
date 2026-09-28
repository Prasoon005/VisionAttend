import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createOrganizationResponseSchema,
  organizationListResponseSchema,
} from '@visionattend/shared';
import { buildTestApp } from '../helpers/test-app.js';
import {
  createUser,
  PASSWORD,
  prisma,
  refreshCookieFrom,
  resetDatabase,
  asCookie,
} from './harness.js';

const app = buildTestApp({ prisma });
let superToken: string;

const newOrg = {
  name: 'Globex Corporation',
  slug: 'globex',
  timezone: 'Asia/Kolkata',
  adminEmail: 'Admin@Globex.example.test',
};

const createOrg = (body: object = newOrg) =>
  request(app)
    .post('/api/v1/platform/organizations')
    .set('Authorization', `Bearer ${superToken}`)
    .send(body);

beforeEach(async () => {
  await resetDatabase();
  await createUser('super@example.test', 'SUPER_ADMIN', null);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'super@example.test', password: PASSWORD });
  superToken = res.body.accessToken;
});

afterAll(() => prisma.$disconnect());

describe('organization onboarding', () => {
  it('creates the organization and its first admin with a one-time password', async () => {
    const res = await createOrg().expect(201);
    const body = createOrganizationResponseSchema.parse(res.body);

    expect(body.organization).toMatchObject({ slug: 'globex', status: 'ACTIVE', userCount: 1 });
    expect(body.admin.email).toBe('admin@globex.example.test');
    expect(res.headers['cache-control']).toBe('no-store');

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: body.admin.id } });
    expect(admin).toMatchObject({ role: 'ORG_ADMIN', mustChangePassword: true });
    expect(admin.passwordHash).not.toContain(body.temporaryPassword);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'organization.create' } });
    expect(JSON.stringify(audit)).not.toContain(body.temporaryPassword);
  });

  it('forces the new admin to change the one-time password before anything else', async () => {
    const { admin, temporaryPassword } = createOrganizationResponseSchema.parse(
      (await createOrg().expect(201)).body,
    );

    const session = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: temporaryPassword })
      .expect(200);
    expect(session.body.user.mustChangePassword).toBe(true);
    const bearer = `Bearer ${session.body.accessToken}`;

    const blocked = await request(app).get('/api/v1/audit-logs').set('Authorization', bearer);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', bearer)
      .send({ currentPassword: temporaryPassword, newPassword: 'my-own-secure-password' })
      .expect(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${changed.body.accessToken}`)
      .expect(200);
  });

  it('returns 409 for a duplicate slug or admin email', async () => {
    await createOrg().expect(201);
    const dupSlug = await createOrg({ ...newOrg, adminEmail: 'other@globex.example.test' });
    expect(dupSlug.status).toBe(409);
    expect(dupSlug.body.error.code).toBe('CONFLICT');

    const dupEmail = await createOrg({ ...newOrg, slug: 'globex-2' });
    expect(dupEmail.status).toBe(409);
    // The transaction rolled back: no half-created organization.
    expect(await prisma.organization.count()).toBe(1);
  });

  it('validates slug and timezone', async () => {
    const res = await createOrg({ ...newOrg, slug: 'Bad Slug!', timezone: 'Mars/Olympus' });
    expect(res.status).toBe(400);
    const paths = (res.body.error.details as { path: string }[]).map(({ path }) => path);
    expect(paths).toEqual(expect.arrayContaining(['slug', 'timezone']));
  });

  it('lists organizations with pagination', async () => {
    await createOrg().expect(201);
    const res = await request(app)
      .get('/api/v1/platform/organizations?page=1&pageSize=10')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);
    const body = organizationListResponseSchema.parse(res.body);
    expect(body.total).toBe(1);
    expect(body.items[0]?.slug).toBe('globex');
  });

  it('suspending an organization ends its users’ sessions', async () => {
    const { organization, admin, temporaryPassword } = createOrganizationResponseSchema.parse(
      (await createOrg().expect(201)).body,
    );
    const adminRefresh = refreshCookieFrom(
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: admin.email, password: temporaryPassword })
        .expect(200),
    );

    const res = await request(app)
      .patch(`/api/v1/platform/organizations/${organization.id}`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    expect(res.body.status).toBe('SUSPENDED');

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', asCookie(adminRefresh))
      .expect(401);
  });

  it('returns 404 when updating an organization that does not exist', async () => {
    await request(app)
      .patch('/api/v1/platform/organizations/0192f4b1-0000-7000-8000-000000000000')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Nobody' })
      .expect(404);
  });
});
