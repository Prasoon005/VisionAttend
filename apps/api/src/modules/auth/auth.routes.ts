import { Router, type CookieOptions, type Response } from 'express';
import { changePasswordRequestSchema, loginRequestSchema } from '@visionattend/shared';
import { UnauthenticatedError } from '../../lib/errors.js';
import type { RateLimiter } from '../../lib/rate-limiter.js';
import { getAuth, getRequestMeta } from '../../lib/request-context.js';
import type { Authenticate } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import type { AuthService, IssuedSession } from './auth.service.js';

export const REFRESH_COOKIE = 'va_refresh';

/**
 * httpOnly: JavaScript (and therefore XSS) cannot read it.
 * Secure: HTTPS only (browsers treat http://localhost as secure too).
 * SameSite=Strict: never sent on cross-site requests, which blocks CSRF.
 * Path: sent only to /api/v1/auth, not with every API call.
 */
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth',
};

function sendSession(res: Response, session: IssuedSession) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...cookieOptions,
    expires: session.refreshTokenExpiresAt,
  });
  // Tokens must never be cached by the browser or a proxy.
  res.setHeader('Cache-Control', 'no-store');
  res.json(session.body);
}

function readRefreshCookie(cookies: unknown): string | undefined {
  const value = (cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createAuthRouter(
  service: AuthService,
  authenticate: Authenticate,
  limiter: RateLimiter,
): Router {
  const router = Router();
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  router.post(
    '/login',
    // Per IP: slows password spraying across many accounts.
    rateLimit(limiter, { name: 'login', limit: 20, windowMs: FIFTEEN_MINUTES }),
    async (req, res) => {
      const body = loginRequestSchema.parse(req.body);
      sendSession(res, await service.login(body, getRequestMeta(req)));
    },
  );

  router.post(
    '/refresh',
    rateLimit(limiter, { name: 'refresh', limit: 60, windowMs: FIFTEEN_MINUTES }),
    async (req, res) => {
      const token = readRefreshCookie(req.cookies);
      try {
        if (!token) throw new UnauthenticatedError('No active session', 'SESSION_EXPIRED');
        sendSession(res, await service.refresh(token, getRequestMeta(req)));
      } catch (error) {
        // A dead cookie is useless to keep; clear it so the browser stops sending it.
        res.clearCookie(REFRESH_COOKIE, cookieOptions);
        throw error;
      }
    },
  );

  router.post('/logout', async (req, res) => {
    await service.logout(readRefreshCookie(req.cookies), getRequestMeta(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.post(
    '/change-password',
    authenticate({ allowPendingPasswordChange: true }),
    rateLimit(limiter, {
      name: 'change-password',
      limit: 10,
      windowMs: FIFTEEN_MINUTES,
      key: (req) => getAuth(req).userId,
    }),
    async (req, res) => {
      const body = changePasswordRequestSchema.parse(req.body);
      const { userId } = getAuth(req);
      sendSession(res, await service.changePassword(userId, body, getRequestMeta(req)));
    },
  );

  router.get('/me', authenticate({ allowPendingPasswordChange: true }), async (req, res) => {
    res.json(await service.me(getAuth(req).userId));
  });

  return router;
}
