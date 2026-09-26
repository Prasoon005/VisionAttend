import { describe, expect, it } from 'vitest';
import { ROLES } from '@visionattend/shared';
import { ConfigError, parseConfig } from '../src/config/env.js';
import { Role } from '../src/generated/prisma/enums.js';

const SECRET = 'x'.repeat(40);
const validEnv = {
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:8080',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://:pass@localhost:6379',
  JWT_SECRET: SECRET,
  CV_SERVICE_URL: 'http://localhost:8000',
  CV_SERVICE_TOKEN: SECRET,
};

describe('environment configuration', () => {
  it('parses a valid environment and applies safe defaults', () => {
    const config = parseConfig(validEnv);
    expect(config.API_PORT).toBe(4000);
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:8080']);
  });

  it('fails fast when a required secret is missing', () => {
    const { JWT_SECRET: _omitted, ...env } = validEnv;
    expect(() => parseConfig(env)).toThrow(ConfigError);
  });

  it('rejects secrets that are too short', () => {
    expect(() => parseConfig({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('rejects placeholder values copied from .env.example', () => {
    const env = { ...validEnv, CV_SERVICE_TOKEN: 'replace_with_long_random_token_000000000' };
    expect(() => parseConfig(env)).toThrow(/placeholder/);
  });

  it('never echoes secret values in the error message', () => {
    const leaky = 'super-secret-but-short';
    try {
      parseConfig({ ...validEnv, JWT_SECRET: leaky });
    } catch (error) {
      expect((error as Error).message).not.toContain(leaky);
    }
  });
});

describe('role definitions', () => {
  it('keep the shared RBAC roles in sync with the database enum', () => {
    expect([...ROLES].sort()).toEqual(Object.values(Role).sort());
  });
});
