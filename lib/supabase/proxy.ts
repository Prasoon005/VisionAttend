import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { publicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session for this request and writes any renewed
 * cookies onto `response`. Returns whether a valid user is signed in.
 *
 * `getUser()` asks the Auth server to validate the token (it cannot be forged
 * by editing cookies), which is why it is used here rather than `getSession()`.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user };
}

/** Copies Set-Cookie values (e.g. a refreshed session) onto another response, such as a redirect. */
export function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}
