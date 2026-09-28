import type { Request, RequestHandler } from 'express';
import { RateLimitedError } from '../lib/errors.js';
import type { RateLimiter } from '../lib/rate-limiter.js';

export interface RateLimitOptions {
  /** Distinguishes limits from each other, e.g. "login". */
  name: string;
  limit: number;
  windowMs: number;
  /** What is being limited; defaults to the client IP. */
  key?: (req: Request) => string;
}

export function rateLimit(limiter: RateLimiter, options: RateLimitOptions): RequestHandler {
  const keyOf = options.key ?? ((req: Request) => req.ip ?? 'unknown');

  return async (req, res, next) => {
    const result = await limiter.hit(
      `${options.name}:${keyOf(req)}`,
      options.limit,
      options.windowMs,
    );
    // IETF draft "RateLimit header fields for HTTP" so clients can back off.
    res.setHeader('RateLimit-Limit', options.limit);
    res.setHeader('RateLimit-Remaining', result.remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(result.resetMs / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.resetMs / 1000));
      req.log.warn({ limit: options.name, ip: req.ip }, 'rate limit exceeded');
      throw new RateLimitedError();
    }
    next();
  };
}
