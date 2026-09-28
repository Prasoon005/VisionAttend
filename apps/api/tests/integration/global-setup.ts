import { execSync } from 'node:child_process';
import path from 'node:path';
import { testDatabaseUrl } from './test-env.js';

/** Creates (if needed) and migrates the test database once per run. */
export default function setup() {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}
