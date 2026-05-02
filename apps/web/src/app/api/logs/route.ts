import { NextResponse } from 'next/server';
import { requireAdminAuth } from '../_lib/admin-auth';

const LOKI_URL = process.env.LOKI_URL ?? 'http://localhost:3100';
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_LIMIT = 500;
const MAX_RANGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function GET(request: Request) {
  const denied = requireAdminAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const rawLimit = Number(url.searchParams.get('limit') ?? '50');
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50, 1),
    MAX_LIMIT,
  );

  const rawSinceSeconds = Number(url.searchParams.get('sinceSeconds') ?? '3600');
  const sinceSeconds = Math.min(
    Math.max(Number.isFinite(rawSinceSeconds) ? Math.floor(rawSinceSeconds) : 3600, 1),
    MAX_RANGE_SECONDS,
  );

  const now = Date.now();
  const upstream = new URL(`${LOKI_URL}/loki/api/v1/query_range`);
  upstream.searchParams.set('query', query);
  upstream.searchParams.set('limit', String(limit));
  upstream.searchParams.set('direction', 'backward');
  upstream.searchParams.set('start', String((now - sinceSeconds * 1000) * 1_000_000));
  upstream.searchParams.set('end', String(now * 1_000_000));

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
      { error: 'loki unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
