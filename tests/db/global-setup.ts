import { execFileSync } from 'node:child_process';

/**
 * Reads the local Supabase URL and keys from `supabase status` so the tests
 * need no hand-maintained env file. Requires `npx supabase start`.
 */
export default function setup() {
  let output: string;
  try {
    output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Local Supabase is not running. Start it with `npx supabase start`.');
  }

  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
      .filter((match): match is RegExpExecArray => match !== null)
      .map(([, key, value]) => [key, value]),
  );

  const url = values.API_URL;
  const publishableKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  const secretKey = values.SECRET_KEY ?? values.SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error('Could not read API_URL / keys from `supabase status -o env`.');
  }
  process.env.TEST_SUPABASE_URL = url;
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY = publishableKey;
  process.env.TEST_SUPABASE_SECRET_KEY = secretKey;
}
