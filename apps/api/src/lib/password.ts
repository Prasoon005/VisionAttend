import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// `Algorithm.Argon2id` from @node-rs/argon2 is an ambient const enum, which
// cannot be imported under `verbatimModuleSyntax`; 2 is its value.
const ARGON2ID = 2;

/**
 * argon2id with the OWASP Password Storage Cheat Sheet baseline
 * (19 MiB memory, 2 iterations, 1 lane). Memory-hard hashing makes GPU and
 * ASIC guessing expensive. The salt is random per hash and embedded in the
 * PHC string ("$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>").
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash must deny access, never crash the login.
    return false;
  }
}

// Hash of a random value nobody knows, computed once on first use.
let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real verification. Used when the email does not
 * exist, so response timing does not reveal which accounts exist.
 */
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64url'));
  await verifyPassword(await dummyHash, password);
}

/** 144 random bits as 24 URL-safe characters; used for one-time onboarding passwords. */
export function generateTemporaryPassword(): string {
  return randomBytes(18).toString('base64url');
}
