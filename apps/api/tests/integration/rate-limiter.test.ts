import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { RedisRateLimiter } from '../../src/lib/rate-limiter.js';
import { createRedisClient } from '../../src/lib/redis.js';
import { silentLogger } from '../helpers/test-app.js';
import { testRedisUrl } from './test-env.js';

const redis = createRedisClient(testRedisUrl(), silentLogger);
const limiter = new RedisRateLimiter(redis, silentLogger);

afterAll(() => redis.quit());

describe('RedisRateLimiter', () => {
  it('allows up to the limit within a window, then blocks', async () => {
    const key = `test:${randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.hit(key, 3, 60_000));

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3]?.resetMs).toBeGreaterThan(0);
    expect(results[3]?.resetMs).toBeLessThanOrEqual(60_000);
  });

  it('starts a new window once the old one expires', async () => {
    const key = `test:${randomUUID()}`;
    await limiter.hit(key, 1, 200);
    expect((await limiter.hit(key, 1, 200)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await limiter.hit(key, 1, 200)).allowed).toBe(true);
  });

  it('fails open when Redis is unreachable', async () => {
    const dead = createRedisClient('redis://127.0.0.1:1', silentLogger);
    const result = await new RedisRateLimiter(dead, silentLogger).hit('any', 1, 60_000);
    expect(result.allowed).toBe(true);
    dead.disconnect();
  });
});
