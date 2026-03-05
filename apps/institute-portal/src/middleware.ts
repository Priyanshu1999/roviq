import { intlMiddleware } from '@roviq/i18n';

export default intlMiddleware;

export const config = {
  matcher: ['/', '/(en|hi)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
