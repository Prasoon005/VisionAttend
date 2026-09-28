import { defineConfig } from 'vitest/config';

// Integration tests: real PostgreSQL (a separate *_test database) and Redis.
// Run with `pnpm test:integration` while `docker compose up -d` is running.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    // Files share one database and reset it, so they must not run in parallel.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
