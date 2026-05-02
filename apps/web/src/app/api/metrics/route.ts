import { NextResponse } from 'next/server';
import { requireAdminAuth } from '../_lib/admin-auth';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL ?? 'http://localhost:9090';
const ALLOWED_ENDPOINTS = new Set(['query', 'query_range']);
const UPSTREAM_TIMEOUT_MS = 8_000;

// Bounds to prevent a hostile/buggy caller from asking Prometheus for
// millions of data points (review M2). 86400 step = 1 sample per day.
const MIN_STEP_SECONDS = 5;
const MAX_STEP_SECONDS = 86_400;
// Cap the time window so a 7-day range with step=5 isn't forwarded.
const MAX_RANGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function GET(request: Request) {
  const denied = requireAdminAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint') ?? 'query_range';
  const query = url.searchParams.get('query');

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { error: `endpoint must be one of ${[...ALLOWED_ENDPOINTS].join(', ')}` },
      { status: 400 },
    );
  }
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const upstream = new URL(`${PROMETHEUS_URL}/api/v1/${endpoint}`);
  upstream.searchParams.set('query', query);

  if (endpoint === 'query_range') {
    const now = Math.floor(Date.now() / 1000);
    const rawStep = Number(url.searchParams.get('step') ?? '30');
    const rawStart = Number(url.searchParams.get('start') ?? String(now - 3600));
    const rawEnd = Number(url.searchParams.get('end') ?? String(now));

    if (!Number.isFinite(rawStep) || !Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
      return NextResponse.json(
        { error: 'step, start, end must be finite numbers' },
        { status: 400 },
      );
    }

    const step = Math.min(Math.max(Math.floor(rawStep), MIN_STEP_SECONDS), MAX_STEP_SECONDS);
    const end = Math.floor(rawEnd);
    const start = Math.max(Math.floor(rawStart), end - MAX_RANGE_SECONDS);
    if (start >= end) {
      return NextResponse.json({ error: 'start must be < end' }, { status: 400 });
    }

    upstream.searchParams.set('step', String(step));
    upstream.searchParams.set('start', String(start));
    upstream.searchParams.set('end', String(end));
  }

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
      { error: 'prometheus unreachable', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
