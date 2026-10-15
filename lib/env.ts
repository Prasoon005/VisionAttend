import { z } from 'zod';

/**
 * Public (browser-visible) configuration, validated once at startup so a
 * missing variable fails loudly instead of causing confusing runtime errors.
 *
 * Each variable is read with a literal `process.env.NEXT_PUBLIC_…` expression:
 * Next.js inlines only those into the browser bundle.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
