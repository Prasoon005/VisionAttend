import { Redis } from 'ioredis';
import type { Logger } from './logger.js';

export type { Redis };

export function createRedisClient(redisUrl: string, logger: Logger): Redis {
  const client = new Redis(redisUrl, {
    // Fail fast on individual commands instead of queueing them forever
    // while Redis is down; reconnection still happens in the background.
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  client.on('error', (error: Error) =>
    logger.warn({ err: error.message }, 'redis connection error'),
  );
  return client;
}
