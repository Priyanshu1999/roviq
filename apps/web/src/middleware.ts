import { type NextRequest, NextResponse } from 'next/server';

const SCOPE_MAP: Record<string, string> = {
  admin: 'admin',
  reseller: 'reseller',
};

function getScopeFromHostname(hostname: string): string {
  const subdomain = hostname.split('.')[0].split(':')[0]; // strip port
  return SCOPE_MAP[subdomain] ?? 'institute';
}

const locales = ['en', 'hi'];
const defaultLocale = 'en';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const hostname = request.headers.get('host') ?? '';
  const scope = getScopeFromHostname(hostname);

  // Check if pathname already has a locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  // Extract locale and remaining path
  let locale = defaultLocale;
  let restPath = pathname;

  if (pathnameHasLocale) {
    locale = pathname.split('/')[1];
    restPath = pathname.slice(locale.length + 1) || '/';
  }

  // Check if path already starts with a scope prefix
  const scopePrefixes = ['admin', 'reseller', 'institute'];
  const pathAfterLocale = pathnameHasLocale ? restPath : pathname;
  const hasScope = scopePrefixes.some(
    (s) => pathAfterLocale.startsWith(`/${s}/`) || pathAfterLocale === `/${s}`,
  );

  // If no scope prefix, rewrite to add it based on hostname
  if (!hasScope) {
    // Root path or bare locale → redirect to scope's login page
    const isRoot = restPath === '/' || restPath === '';
    const targetPath = isRoot ? '/login' : restPath;

    const newPath = pathnameHasLocale
      ? `/${locale}/${scope}${targetPath}`
      : `/${defaultLocale}/${scope}${pathname === '/' ? '/login' : pathname}`;

    const url = request.nextUrl.clone();
    url.pathname = newPath;
    return NextResponse.rewrite(url);
  }

  // If no locale prefix, add default locale
  if (!pathnameHasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
