import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Next.js 16 "proxy" (formerly middleware). For now it only negotiates the
 * locale (URL → cookie → Accept-Language) and redirects "/" to "/<locale>".
 * Session refresh and route protection join it in Phase 1.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
