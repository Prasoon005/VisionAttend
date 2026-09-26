import type { PrismaClient } from '../../lib/prisma.js';
import type { Redis } from '../../lib/redis.js';
import type { HealthProbes } from './health.service.js';

interface ProbeDependencies {
  prisma: PrismaClient;
  redis: Redis;
  cvServiceUrl: string;
  cvServiceToken: string;
  timeoutMs: number;
}

/** Real dependency probes. Tests substitute fakes via HealthService. */
export function createHealthProbes(deps: ProbeDependencies): HealthProbes {
  return {
    database: async () => {
      await deps.prisma.$queryRaw`SELECT 1`;
    },
    redis: async () => {
      const reply = await deps.redis.ping();
      if (reply !== 'PONG') throw new Error(`unexpected redis reply: ${reply}`);
    },
    // Calls an authenticated internal endpoint, so readiness also proves the
    // API <-> CV shared token is configured correctly on both sides.
    cvService: async () => {
      const response = await fetch(new URL('/internal/v1/info', deps.cvServiceUrl), {
        headers: { 'X-Service-Token': deps.cvServiceToken },
        signal: AbortSignal.timeout(deps.timeoutMs),
      });
      if (!response.ok) throw new Error(`cv-service responded ${response.status}`);
    },
  };
}
