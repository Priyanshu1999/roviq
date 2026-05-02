// Server-side gate for the observability proxy routes (/api/metrics,
// /api/logs, /api/traces, /api/alerts). Browser attaches the platform-scope
// access token via `Authorization: Bearer …` (see _lib/auth-fetch.ts in the
// observability dir); this verifies the JWT and confirms the `scope` claim.
//
// Why JWT verify here even though the api-gateway also enforces it:
// these routes don't proxy to the api-gateway — they proxy directly to
// Prometheus/Loki/Tempo, which have NO auth of their own. Without a check
// here every browser/bot can scrape live metrics + log content.

import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

interface AdminTokenPayload {
  scope?: string;
  type?: string;
  sub?: string;
}

const REQUIRED_SCOPE = 'platform';

/**
 * Returns a `NextResponse` 401 if the caller is not a verified
 * platform-scope user, else returns null (caller proceeds).
 */
export function requireAdminAuth(request: Request): NextResponse | null {
  const auth = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized', detail: 'missing bearer token' },
      { status: 401 },
    );
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', detail: 'empty bearer token' },
      { status: 401 },
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Server misconfigured', detail: 'JWT_SECRET not set' },
      { status: 500 },
    );
  }

  try {
    const decoded = jwt.verify(token, secret) as AdminTokenPayload;
    if (decoded.scope !== REQUIRED_SCOPE) {
      return NextResponse.json(
        { error: 'Forbidden', detail: `scope must be ${REQUIRED_SCOPE}` },
        { status: 403 },
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized', detail: 'invalid or expired token' },
      { status: 401 },
    );
  }
}
