import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Environment configuration, validated once at startup.
 *
 * The API refuses to start with missing, malformed or placeholder secrets
 * instead of silently falling back to insecure defaults. Only non-secret
 * operational settings (port, log level) have defaults.
 */

const PLACEHOLDER_MARKER = 'replace_with';

const noPlaceholder = (value: string) => !value.includes(PLACEHOLDER_MARKER);

const secret = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters`)
    .refine(noPlaceholder, `${name} still contains a placeholder value`);

const connectionUrl = (name: string) =>
  z
    .url({ error: `${name} must be a valid URL` })
    .refine(noPlaceholder, `${name} still contains a placeholder value`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z
    .string({ error: 'CORS_ORIGINS is required' })
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1, 'CORS_ORIGINS must list at least one origin')),
  DATABASE_URL: connectionUrl('DATABASE_URL'),
  REDIS_URL: connectionUrl('REDIS_URL'),
  JWT_SECRET: secret('JWT_SECRET'),
  CV_SERVICE_URL: z.url({ error: 'CV_SERVICE_URL must be a valid URL' }),
  CV_SERVICE_TOKEN: secret('CV_SERVICE_TOKEN'),
});

export type AppConfig = z.output<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Parses configuration from a plain object (defaults to `process.env`). */
export function parseConfig(source: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Issue messages name the variable but never echo its value.
    throw new ConfigError(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Loads the repository-root `.env` (if present) and validates it. */
export function loadConfig(): AppConfig {
  // src/config and dist/config are both four levels below the repo root.
  loadDotenv({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true });
  return parseConfig(process.env);
}
