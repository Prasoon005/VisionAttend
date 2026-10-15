import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { isProtected } from './lib/auth/route-access';
import { copyCookies, updateSession } from './lib/supabase/proxy';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Runs before every page request (Next.js 16 "proxy", formerly middleware):
 *  1. next-intl negotiates the locale and redirects "/" to "/<locale>".
 *  2. The Supabase session is refreshed (renewed cookies are passed along).
 *  3. Signed-out visitors are sent from protected areas to the sign-in page,
 *     remembering where they wanted to go.
 *
 * Role checks happen in the protected layouts, which read the live profile
 * (roles are not stored in the token; see ADR-014). RLS is the final layer.
 */
export default async function proxy(request: NextRequest) {
  const response = intl(request);
  // A locale redirect: let the browser follow it first.
  if (response.headers.has('location')) return response;

  const { user } = await updateSession(request, response);

  const [, locale = routing.defaultLocale, ...rest] = request.nextUrl.pathname.split('/');
  const pathname = `/${rest.join('/')}`;

  if (!user && isProtected(pathname)) {
    const loginPath =
      pathname.startsWith('/admin') || pathname.startsWith('/platform') ? 'admin/login' : 'login';
    const url = new URL(`/${locale}/${loginPath}`, request.url);
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
