import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true });

/**
 * The integration database is always the development database name plus
 * "_test", so tests (which wipe every table) can never touch dev data.
 */
export function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is not set; copy .env.example to .env');
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/_test$/, '')}_test`;
  return url.toString();
}

export function testRedisUrl(): string {
  const base = process.env.REDIS_URL;
  if (!base) throw new Error('REDIS_URL is not set; copy .env.example to .env');
  const url = new URL(base);
  url.pathname = '/15'; // a separate logical database for tests
  return url.toString();
}
