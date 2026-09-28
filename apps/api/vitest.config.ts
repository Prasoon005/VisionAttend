import { defineConfig } from 'vitest/config';

// Unit tests: no database, Redis or network needed.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
  },
});
