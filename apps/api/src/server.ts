import { readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createPrismaClient } from './lib/prisma.js';
import { createRedisClient } from './lib/redis.js';
import { createHealthProbes } from './modules/health/health.probes.js';
import { HealthService } from './modules/health/health.service.js';

const HEALTH_TIMEOUT_MS = 2000;

// src/ and dist/ both sit directly below the package root.
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger({
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === 'development',
  });
  const prisma = createPrismaClient(config.DATABASE_URL);
  const redis = createRedisClient(config.REDIS_URL, logger);

  const healthService = new HealthService({
    version,
    logger,
    timeoutMs: HEALTH_TIMEOUT_MS,
    probes: createHealthProbes({
      prisma,
      redis,
      cvServiceUrl: config.CV_SERVICE_URL,
      cvServiceToken: config.CV_SERVICE_TOKEN,
      timeoutMs: HEALTH_TIMEOUT_MS,
    }),
  });

  const app = createApp({ logger, corsOrigins: config.CORS_ORIGINS, healthService });

  // Dependencies may still be starting; the API boots anyway and reports
  // their state through /api/v1/health/ready instead of crash-looping.
  redis.connect().catch(() => undefined);

  const server = app.listen(config.API_PORT, () => {
    logger.info({ port: config.API_PORT, env: config.NODE_ENV }, 'api listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    // Stop accepting connections, let in-flight requests finish, then close pools.
    server.close(async () => {
      await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
      logger.info('shutdown complete');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
