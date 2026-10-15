import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Database tests: run against the local Supabase stack (`npx supabase start`)
 * and sign in as real users to prove the Row Level Security rules.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    globalSetup: ['./tests/db/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
