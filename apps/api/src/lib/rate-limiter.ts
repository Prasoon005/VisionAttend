import type { Logger } from './logger.js';
import type { Redis } from './redis.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the current window resets. */
  resetMs: number;
}

export interface RateLimiter {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

const REDIS_TIMEOUT_MS = 500;

/**
 * Fixed-window counter in Redis, shared by every API instance.
 *
 * The first request in a window creates the key with a TTL (PEXPIRE ... NX
 * sets it only once); later requests just increment it. MULTI makes the
 * three commands one atomic round trip.
 *
 * Fails open: if Redis is unavailable the request is allowed and a warning is
 * logged. Account lockout in the database still protects logins, and an
 * outage of a supporting service should not lock every user out.
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    try {
      const results = await withTimeout(
        this.redis.multi().incr(redisKey).pexpire(redisKey, windowMs, 'NX').pttl(redisKey).exec(),
        REDIS_TIMEOUT_MS,
      );
      const count = Number(results?.[0]?.[1]);
      const ttl = Number(results?.[2]?.[1]);
      if (!Number.isFinite(count)) throw new Error('unexpected MULTI result');
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetMs: ttl > 0 ? ttl : windowMs,
      };
    } catch (error) {
      this.logger.warn({ err: (error as Error).message, key }, 'rate limiter unavailable');
      return { allowed: true, remaining: limit, resetMs: windowMs };
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
