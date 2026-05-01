// Test/dev-only readiness probe. Returns 404 in production unless explicitly
// opted in via E2E_PROBE=1 — never expose build env in real deployments.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.E2E_PROBE !== '1') {
    return new NextResponse('Not Found', { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? null,
      NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER:
        process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    buildId: process.env.NEXT_BUILD_ID ?? null,
  });
}
