import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { ROLES, type Role } from '@visionattend/shared';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ISSUER = 'visionattend-api';
const AUDIENCE = 'visionattend';
const ALGORITHM = 'HS256';

/** What the API knows about the caller after verifying the access token. */
export interface AccessTokenClaims {
  userId: string;
  role: Role;
  /** null only for the Super Admin. */
  organizationId: string | null;
  mustChangePassword: boolean;
}

const payloadSchema = z.object({
  sub: z.uuid(),
  role: z.enum(ROLES),
  org: z.uuid().nullable(),
  pwc: z.boolean(),
});

/**
 * Signs and verifies short-lived access JWTs. The algorithm is pinned on
 * verification, which blocks "alg: none" and algorithm-confusion attacks, and
 * issuer/audience are checked so tokens minted for another purpose are useless.
 */
export class TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({
      role: claims.role,
      org: claims.organizationId,
      pwc: claims.mustChangePassword,
    })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  /** Throws if the token is malformed, forged, expired or not ours. */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const { sub, role, org, pwc } = payloadSchema.parse(payload);
    return { userId: sub, role, organizationId: org, mustChangePassword: pwc };
  }
}

/**
 * Refresh tokens are opaque random values, not JWTs: they carry no data and
 * are only meaningful as a database lookup, so the server can revoke them.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only this hash is stored. SHA-256 (not argon2) is enough because the input
 * is 256 random bits, not a guessable password; a leaked table is useless.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
