import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorResponseSchema, authSessionResponseSchema } from '@visionattend/shared';
import { LOCKOUT_MS, MAX_FAILED_LOGINS } from '../../src/modules/auth/auth.service.js';
import { buildTestApp } from '../helpers/test-app.js';
import {
  asCookie,
  createOrganization,
  createUser,
  PASSWORD,
  prisma,
  refreshCookieFrom,
  resetDatabase,
} from './harness.js';

let clock = new Date('2026-09-01T09:00:00Z');
const app = buildTestApp({ prisma, now: () => clock });

const login = (email: string, password = PASSWORD) =>
  request(app).post('/api/v1/auth/login').send({ email, password });
const refresh = (token: string) =>
  request(app).post('/api/v1/auth/refresh').set('Cookie', asCookie(token));

let orgId: string;

beforeEach(async () => {
  clock = new Date('2026-09-01T09:00:00Z');
  await resetDatabase();
  orgId = (await createOrganization('acme')).id;
  await createUser('admin@acme.example.test', 'ORG_ADMIN', orgId);
});

afterAll(() => prisma.$disconnect());

describe('POST /auth/login', () => {
  it('issues an access token and a hardened refresh cookie', async () => {
    const res = await login('ADMIN@acme.example.test ').expect(200);

    const body = authSessionResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ email: 'admin@acme.example.test', role: 'ORG_ADMIN' });
    expect(body.user.permissions).toContain('audit:read');
    expect(res.headers['cache-control']).toBe('no-store');

    const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'auth.login' } });
    expect(audit).toMatchObject({ organizationId: orgId, requestId: res.headers['x-request-id'] });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await login('admin@acme.example.test', 'wrong-password').expect(401);
    const unknownEmail = await login('nobody@acme.example.test').expect(401);
    const a = apiErrorResponseSchema.parse(wrongPassword.body).error;
    const b = apiErrorResponseSchema.parse(unknownEmail.body).error;
    expect([a.code, a.message]).toEqual([b.code, b.message]);
    expect(a.code).toBe('INVALID_CREDENTIALS');
  });

  it('records failed logins without storing the attempted password', async () => {
    await login('admin@acme.example.test', 'hunter2-guess').expect(401);
    const entry = await prisma.auditLog.findFirst({ where: { action: 'auth.login_failed' } });
    expect(entry?.metadata).toEqual({ reason: 'wrong_password' });
    expect(JSON.stringify(entry)).not.toContain('hunter2');
  });

  it(`locks the account for 15 minutes after ${MAX_FAILED_LOGINS} failures`, async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await login('admin@acme.example.test', 'wrong-password').expect(401);
    }
    // Even the correct password is refused while locked, with the same message.
    const locked = await login('admin@acme.example.test').expect(401);
    expect(locked.body.error.code).toBe('INVALID_CREDENTIALS');

    clock = new Date(clock.getTime() + LOCKOUT_MS + 1000);
    await login('admin@acme.example.test').expect(200);
  });

  it('refuses disabled users and suspended organizations once the password is right', async () => {
    await prisma.user.update({
      where: { email: 'admin@acme.example.test' },
      data: { status: 'DISABLED' },
    });
    expect((await login('admin@acme.example.test').expect(403)).body.error.code).toBe(
      'ACCOUNT_DISABLED',
    );

    await createUser('hr@acme.example.test', 'ORG_ADMIN', orgId);
    await prisma.organization.update({ where: { id: orgId }, data: { status: 'SUSPENDED' } });
    expect((await login('hr@acme.example.test').expect(403)).body.error.code).toBe(
      'ORGANIZATION_SUSPENDED',
    );
  });

  it('validates the request body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token on every use', async () => {
    const first = refreshCookieFrom(await login('admin@acme.example.test').expect(200));
    const res = await refresh(first).expect(200);
    const second = refreshCookieFrom(res);

    expect(second).not.toBe(first);
    authSessionResponseSchema.parse(res.body);
    await refresh(second).expect(200);
  });

  it('revokes the whole family when a rotated token is reused (theft detection)', async () => {
    const stolen = refreshCookieFrom(await login('admin@acme.example.test').expect(200));
    const legitimate = refreshCookieFrom(await refresh(stolen).expect(200));

    // The attacker replays the old token...
    const replay = await refresh(stolen).expect(401);
    expect(replay.body.error.code).toBe('SESSION_EXPIRED');
    // ...and the legitimate user's newer token is dead too.
    await refresh(legitimate).expect(401);

    expect(await prisma.auditLog.count({ where: { action: 'auth.refresh_reuse' } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('rejects expired tokens', async () => {
    const token = refreshCookieFrom(await login('admin@acme.example.test').expect(200));
    clock = new Date(clock.getTime() + 8 * 24 * 60 * 60 * 1000);
    await refresh(token).expect(401);
  });

  it('rejects missing and unknown tokens and clears the cookie', async () => {
    await request(app).post('/api/v1/auth/refresh').expect(401);
    const res = await refresh('made-up-token').expect(401);
    expect(String(res.headers['set-cookie'])).toMatch(/va_refresh=;/);
  });

  it('stops refreshing once the organization is suspended', async () => {
    const token = refreshCookieFrom(await login('admin@acme.example.test').expect(200));
    await prisma.organization.update({ where: { id: orgId }, data: { status: 'SUSPENDED' } });
    await refresh(token).expect(403);
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const token = refreshCookieFrom(await login('admin@acme.example.test').expect(200));
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', asCookie(token))
      .expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/va_refresh=;/);
    await refresh(token).expect(401);
  });

  it('is idempotent without a session', async () => {
    await request(app).post('/api/v1/auth/logout').expect(204);
  });
});

describe('GET /auth/me and POST /auth/change-password', () => {
  it('returns the signed-in user', async () => {
    const { accessToken } = (await login('admin@acme.example.test')).body;
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ email: 'admin@acme.example.test', mustChangePassword: false });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('changes the password and signs out every other session', async () => {
    const otherDevice = refreshCookieFrom(await login('admin@acme.example.test').expect(200));
    const { accessToken } = (await login('admin@acme.example.test')).body;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-password' })
      .expect(200);
    authSessionResponseSchema.parse(res.body);

    await refresh(otherDevice).expect(401);
    await login('admin@acme.example.test').expect(401);
    await login('admin@acme.example.test', 'a-brand-new-password').expect(200);
  });

  it('rejects a wrong current password and a too-short new one', async () => {
    const { accessToken } = (await login('admin@acme.example.test')).body;
    const change = (body: object) =>
      request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body);

    expect(
      (await change({ currentPassword: 'wrong', newPassword: 'long-enough-password' }).expect(400))
        .body.error.code,
    ).toBe('INVALID_CURRENT_PASSWORD');
    expect(
      (await change({ currentPassword: PASSWORD, newPassword: 'short' }).expect(400)).body.error
        .code,
    ).toBe('VALIDATION_ERROR');
  });
});
