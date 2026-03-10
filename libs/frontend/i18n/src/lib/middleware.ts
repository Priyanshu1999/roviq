import createMiddleware from 'next-intl/middleware';
import { routing } from './routing';

export const intlMiddleware = createMiddleware(routing);

export const intlMatcherConfig = {
  matcher: ['/', '/(en|hi)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
