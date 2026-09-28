import type { Request } from 'express';
import type { AccessTokenClaims } from './tokens.js';
import { ForbiddenError, UnauthenticatedError } from './errors.js';

/**
 * The verified caller is attached to the request by `authenticate`. A WeakMap
 * keeps it off the Request object, so no global type augmentation is needed
 * and nothing else can set it by accident (e.g. from a parsed body).
 */
const authByRequest = new WeakMap<Request, AccessTokenClaims>();

export function setAuth(req: Request, claims: AccessTokenClaims): void {
  authByRequest.set(req, claims);
}

/** The authenticated caller. Throws 401 if `authenticate` did not run. */
export function getAuth(req: Request): AccessTokenClaims {
  const claims = authByRequest.get(req);
  if (!claims) throw new UnauthenticatedError();
  return claims;
}

/**
 * Tenant scope for repositories. It comes only from the verified token, never
 * from the URL or body, so a caller cannot ask for another organization.
 */
export interface TenantContext {
  organizationId: string;
  userId: string;
}

export function getTenant(req: Request): TenantContext {
  const { organizationId, userId } = getAuth(req);
  if (!organizationId) throw new ForbiddenError('This action requires an organization account');
  return { organizationId, userId };
}

/** Who/where a request came from, recorded with audit entries. */
export interface RequestMeta {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

export function getRequestMeta(req: Request): RequestMeta {
  return {
    requestId: String(req.id),
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
  };
}
