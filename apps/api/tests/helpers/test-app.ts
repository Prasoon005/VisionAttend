import { pino } from 'pino';
import { createApp, type AppDependencies } from '../../src/app.js';
import { createPrismaClient } from '../../src/lib/prisma.js';
import type { RateLimiter } from '../../src/lib/rate-limiter.js';
import { HealthService, type HealthProbes } from '../../src/modules/health/health.service.js';

export const TEST_JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
export const silentLogger = pino({ level: 'silent' });

const up = async () => {};

/** Never limits. Individual tests pass a real limiter when they need one. */
export const unlimited: RateLimiter = {
  hit: async (_key, limit, windowMs) => ({ allowed: true, remaining: limit, resetMs: windowMs }),
};

/**
 * Builds the full app. Unless a test passes its own `prisma`, the client
 * points at a database that does not exist: Prisma connects lazily, so tests
 * that never query (health, middleware) run without Postgres.
 */
export function buildTestApp(
  overrides: Partial<AppDependencies> & { probes?: Partial<HealthProbes> } = {},
) {
  const { probes, ...deps } = overrides;
  const healthService = new HealthService({
    version: 'test',
    logger: silentLogger,
    timeoutMs: 100,
    probes: { database: up, redis: up, cvService: up, ...probes },
  });
  return createApp({
    logger: silentLogger,
    corsOrigins: ['http://localhost:5173'],
    healthService,
    prisma: createPrismaClient('postgresql://nobody:nothing@127.0.0.1:1/none'),
    rateLimiter: unlimited,
    jwtSecret: TEST_JWT_SECRET,
    ...deps,
  });
}
