import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Role } from '@visionattend/shared';
import type { RateLimiter } from '../src/lib/rate-limiter.js';
import { TokenService } from '../src/lib/tokens.js';
import { buildTestApp, TEST_JWT_SECRET } from './helpers/test-app.js';

// These tests stop at the middleware: every request is rejected before any
// database query runs, so no Postgres is needed.

const tokens = new TokenService(TEST_JWT_SECRET);

function tokenFor(role: Role, options: { mustChangePassword?: boolean } = {}) {
  return tokens.signAccessToken({
    userId: randomUUID(),
    role,
    organizationId: role === 'SUPER_ADMIN' ? null : randomUUID(),
    mustChangePassword: options.mustChangePassword ?? false,
  });
}

describe('authenticate', () => {
  const app = buildTestApp();

  it('rejects requests without a bearer token', async () => {
    const res = await request(app).get('/api/v1/platform/organizations').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('rejects malformed and tampered tokens', async () => {
    const token = await tokenFor('SUPER_ADMIN');
    const tampered = `${token.slice(0, -4)}AAAA`;
    for (const header of ['Bearer nonsense', `Basic ${token}`, `Bearer ${tampered}`]) {
      const res = await request(app)
        .get('/api/v1/platform/organizations')
        .set('Authorization', header)
        .expect(401);
      expect(['UNAUTHENTICATED', 'TOKEN_INVALID']).toContain(res.body.error.code);
    }
  });

  it('blocks users who must change their password from everything else', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${await tokenFor('ORG_ADMIN', { mustChangePassword: true })}`)
      .expect(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('requirePermission', () => {
  const app = buildTestApp();

  it.each<[string, Role]>([
    ['/api/v1/platform/organizations', 'ORG_ADMIN'],
    ['/api/v1/platform/organizations', 'EMPLOYEE'],
    ['/api/v1/audit-logs', 'EMPLOYEE'],
    // Least privilege: the platform operator cannot read tenant audit data.
    ['/api/v1/audit-logs', 'SUPER_ADMIN'],
  ])('GET %s is forbidden for %s', async (path, role) => {
    const res = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${await tokenFor(role)}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After once the limit is exceeded', async () => {
    const counts = new Map<string, number>();
    const limiter: RateLimiter = {
      hit: async (key, limit, windowMs) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          resetMs: windowMs,
        };
      },
    };
    const app = buildTestApp({ rateLimiter: limiter });
    // The login limit is 20 per 15 minutes per IP; the body is invalid, so
    // allowed requests stop at validation (400) without touching the database.
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/v1/auth/login').send({}).expect(400);
    }
    const res = await request(app).post('/api/v1/auth/login').send({}).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('never rate-limits health checks', async () => {
    const denyAll: RateLimiter = {
      hit: async (_key, limit, windowMs) => ({ allowed: false, remaining: 0, resetMs: windowMs }),
    };
    await request(buildTestApp({ rateLimiter: denyAll }))
      .get('/api/v1/health')
      .expect(200);
  });
});
