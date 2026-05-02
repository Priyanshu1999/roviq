import { NextResponse } from 'next/server';
import { requireAdminAuth } from '../_lib/admin-auth';

const TEMPO_URL = process.env.TEMPO_URL ?? 'http://localhost:3200';
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_LIMIT = 100;
const MAX_RANGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function GET(request: Request) {
  const denied = requireAdminAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);

  const rawLimit = Number(url.searchParams.get('limit') ?? '20');
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 1),
    MAX_LIMIT,
  );

  const rawSinceSeconds = Number(url.searchParams.get('sinceSeconds') ?? '3600');
  const sinceSeconds = Math.min(
    Math.max(Number.isFinite(rawSinceSeconds) ? Math.floor(rawSinceSeconds) : 3600, 1),
    MAX_RANGE_SECONDS,
  );

  const tags = url.searchParams.get('q');

  const now = Math.floor(Date.now() / 1000);
  const upstream = new URL(`${TEMPO_URL}/api/search`);
  upstream.searchParams.set('limit', String(limit));
  upstream.searchParams.set('start', String(now - sinceSeconds));
  upstream.searchParams.set('end', String(now));
  if (tags) upstream.searchParams.set('q', tags);

  try {
    const res = await fetch(upstream.toString(), {
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
      { error: 'tempo unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
