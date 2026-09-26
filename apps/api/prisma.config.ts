import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Local development keeps a single `.env` at the repository root.
// In containers the variables are injected and the missing file is ignored.
loadEnv({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Optional here so `prisma generate` (run on install) works without a
    // database. Migration commands fail with a clear error if it is unset.
    url: process.env.DATABASE_URL,
  },
});
