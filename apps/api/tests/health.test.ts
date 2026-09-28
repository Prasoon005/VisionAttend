import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  livenessResponseSchema,
  readinessResponseSchema,
} from '@visionattend/shared';
import type { HealthProbes } from '../src/modules/health/health.service.js';
import { buildTestApp } from './helpers/test-app.js';

const buildApp = (probes: Partial<HealthProbes> = {}) => buildTestApp({ probes });

describe('GET /api/v1/health (liveness)', () => {
  it('returns ok with the shared response contract', async () => {
    const res = await request(buildApp()).get('/api/v1/health').expect(200);
    expect(livenessResponseSchema.parse(res.body).status).toBe('ok');
  });

  it('does not depend on the database being up', async () => {
    const app = buildApp({ database: () => Promise.reject(new Error('down')) });
    await request(app).get('/api/v1/health').expect(200);
  });
});

describe('GET /api/v1/health/ready (readiness)', () => {
  it('reports ready when every dependency responds', async () => {
    const res = await request(buildApp()).get('/api/v1/health/ready').expect(200);
    const body = readinessResponseSchema.parse(res.body);
    expect(body.status).toBe('ready');
    expect(body.checks.database.status).toBe('up');
  });

  it('returns 503 without leaking internal error details', async () => {
    const app = buildApp({
      redis: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:6379')),
    });
    const res = await request(app).get('/api/v1/health/ready').expect(503);
    const body = readinessResponseSchema.parse(res.body);
    expect(body.status).toBe('degraded');
    expect(body.checks.redis).toMatchObject({ status: 'down', error: 'unavailable' });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('marks a hanging dependency as timed out', async () => {
    const app = buildApp({ cvService: () => new Promise(() => {}) });
    const res = await request(app).get('/api/v1/health/ready').expect(503);
    expect(res.body.checks.cvService).toMatchObject({ status: 'down', error: 'timeout' });
  });
});

describe('cross-cutting HTTP behaviour', () => {
  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(buildApp()).get('/api/v1/does-not-exist').expect(404);
    expect(apiErrorResponseSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(buildApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(buildApp()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('propagates a well-formed request id and generates one otherwise', async () => {
    const withId = await request(buildApp())
      .get('/api/v1/health')
      .set('X-Request-Id', 'trace-12345678');
    expect(withId.headers['x-request-id']).toBe('trace-12345678');

    const injected = await request(buildApp())
      .get('/api/v1/health')
      .set('X-Request-Id', 'bad id with spaces');
    expect(injected.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('only allows configured CORS origins', async () => {
    const allowed = await request(buildApp())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const blocked = await request(buildApp())
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
