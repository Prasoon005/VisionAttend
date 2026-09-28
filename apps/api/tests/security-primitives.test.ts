import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  generateTemporaryPassword,
  hashPassword,
  verifyDummyPassword,
  verifyPassword,
} from '../src/lib/password.js';
import { generateRefreshToken, hashRefreshToken, TokenService } from '../src/lib/tokens.js';
import { TEST_JWT_SECRET } from './helpers/test-app.js';

describe('password hashing', () => {
  it('uses argon2id with a per-hash salt', async () => {
    const [a, b] = await Promise.all([
      hashPassword('correct horse'),
      hashPassword('correct horse'),
    ]);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b); // different salts
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword(stored, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(stored, 'Correct horse battery')).toBe(false);
  });

  it('denies (not crashes) on a malformed stored hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('dummy verification completes without revealing anything', async () => {
    await expect(verifyDummyPassword('guess')).resolves.toBeUndefined();
  });

  it('generates long, unique temporary passwords', () => {
    const passwords = new Set(Array.from({ length: 50 }, generateTemporaryPassword));
    expect(passwords.size).toBe(50);
    for (const password of passwords) expect(password).toMatch(/^[\w-]{24}$/);
  });
});

describe('access tokens', () => {
  const tokens = new TokenService(TEST_JWT_SECRET);
  const claims = {
    userId: randomUUID(),
    role: 'ORG_ADMIN' as const,
    organizationId: randomUUID(),
    mustChangePassword: false,
  };

  it('round-trips the claims', async () => {
    const token = await tokens.signAccessToken(claims);
    expect(await tokens.verifyAccessToken(token)).toEqual(claims);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new TokenService('another-secret-'.padEnd(48, 'y')).signAccessToken(
      claims,
    );
    await expect(tokens.verifyAccessToken(forged)).rejects.toThrow();
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: claims.userId,
      role: 'SUPER_ADMIN',
      org: null,
      pwc: false,
      iss: 'visionattend-api',
      aud: 'visionattend',
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;
    await expect(tokens.verifyAccessToken(unsigned)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const key = new TextEncoder().encode(TEST_JWT_SECRET);
    const expired = await new SignJWT({ role: 'EMPLOYEE', org: claims.organizationId, pwc: false })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer('visionattend-api')
      .setAudience('visionattend')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key);
    await expect(tokens.verifyAccessToken(expired)).rejects.toThrow();
  });

  it('rejects a correctly signed token with unexpected claims', async () => {
    const key = new TextEncoder().encode(TEST_JWT_SECRET);
    const bogusRole = await new SignJWT({ role: 'ROOT', org: null, pwc: false })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer('visionattend-api')
      .setAudience('visionattend')
      .setExpirationTime('5m')
      .sign(key);
    await expect(tokens.verifyAccessToken(bogusRole)).rejects.toThrow();
  });
});

describe('refresh tokens', () => {
  it('are 256-bit random values stored only as SHA-256 hashes', () => {
    const token = generateRefreshToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).not.toContain(token);
    expect(generateRefreshToken()).not.toBe(token);
  });
});
