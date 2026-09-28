import type { RequestHandler } from 'express';
import { hasPermission, type Permission } from '@visionattend/shared';
import { ForbiddenError, UnauthenticatedError } from '../lib/errors.js';
import { getAuth, setAuth } from '../lib/request-context.js';
import type { TokenService } from '../lib/tokens.js';

export interface AuthenticateOptions {
  /**
   * Let through users who still have to replace a generated password.
   * Only the endpoints needed to do that (me, change-password, logout) set it.
   */
  allowPendingPasswordChange?: boolean;
}

export type Authenticate = (options?: AuthenticateOptions) => RequestHandler;

/**
 * Verifies `Authorization: Bearer <access token>`. Verification is purely
 * cryptographic (no database lookup): disabling a user or suspending an
 * organization revokes refresh tokens, so access ends within the 15-minute
 * access-token lifetime.
 */
export function createAuthenticate(tokens: TokenService): Authenticate {
  return (options = {}) =>
    async (req, res, next) => {
      const header = req.get('authorization');
      const match = header?.match(/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/);
      if (!match?.[1]) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        throw new UnauthenticatedError();
      }

      let claims;
      try {
        claims = await tokens.verifyAccessToken(match[1]);
      } catch {
        res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
        throw new UnauthenticatedError('Access token is invalid or expired', 'TOKEN_INVALID');
      }

      if (claims.mustChangePassword && !options.allowPendingPasswordChange) {
        throw new ForbiddenError(
          'You must change your password before continuing',
          'PASSWORD_CHANGE_REQUIRED',
        );
      }

      setAuth(req, claims);
      next();
    };
}

/** Routes are guarded by permissions, never by role names (see packages/shared). */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    const { role, userId } = getAuth(req);
    if (!hasPermission(role, permission)) {
      req.log.warn({ userId, role, permission }, 'permission denied');
      throw new ForbiddenError();
    }
    next();
  };
}
