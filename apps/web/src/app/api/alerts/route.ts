import { NextResponse } from 'next/server';
import { requireAdminAuth } from '../_lib/admin-auth';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL ?? 'http://localhost:9090';
const UPSTREAM_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  const denied = requireAdminAuth(request);
  if (denied) return denied;

  try {
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/alerts`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'prometheus unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
