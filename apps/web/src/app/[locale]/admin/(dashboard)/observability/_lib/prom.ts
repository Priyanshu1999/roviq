import { useState } from 'react';
import { authFetch, errMessage, sanitizeServiceNames } from './auth-fetch';
import type { TimeRange } from './constants';
import { usePollingEffect } from './polling';

export interface PromResponse<T extends 'matrix' | 'vector'> {
  status: string;
  data?: {
    resultType: T;
    result: Array<{
      metric: Record<string, string>;
      values?: Array<[number, string]>;
      value?: [number, string];
    }>;
  };
  error?: string;
}

export interface SeriesPoint {
  ts: number;
  [key: string]: number;
}

export type MatrixData = PromResponse<'matrix'>['data'];

export function reshapeMatrix(
  matrix: MatrixData,
  legendKey: (m: Record<string, string>) => string,
): { points: SeriesPoint[]; series: string[] } {
  if (!matrix?.result?.length) return { points: [], series: [] };
  const tsSet = new Set<number>();
  const seriesMap = new Map<string, Map<number, number>>();
  for (const row of matrix.result) {
    if (!row.values) continue;
    const key = legendKey(row.metric);
    if (!seriesMap.has(key)) seriesMap.set(key, new Map());
    const inner = seriesMap.get(key);
    if (!inner) continue;
    for (const [ts, val] of row.values) {
      tsSet.add(ts);
      const num = Number.parseFloat(val);
      inner.set(ts, Number.isFinite(num) ? num : 0);
    }
  }
  const series = [...seriesMap.keys()];
  const points = [...tsSet]
    .sort((a, b) => a - b)
    .map((ts) => {
      const point: SeriesPoint = { ts };
      for (const key of series) point[key] = seriesMap.get(key)?.get(ts) ?? 0;
      return point;
    });
  return { points, series };
}

export function formatTime(ts: number, range: TimeRange): string {
  const d = new Date(ts * 1000);
  return range.seconds >= 86400
    ? d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export async function fetchRange(
  query: string,
  range: { seconds: number; step: number },
): Promise<PromResponse<'matrix'>> {
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    endpoint: 'query_range',
    query,
    step: String(range.step),
    start: String(now - range.seconds),
    end: String(now),
  });
  const res = await authFetch(`/api/metrics?${params}`);
  return (await res.json()) as PromResponse<'matrix'>;
}

export async function fetchInstant(query: string): Promise<number | null> {
  const params = new URLSearchParams({ endpoint: 'query', query });
  const res = await authFetch(`/api/metrics?${params}`);
  const body = (await res.json()) as PromResponse<'vector'>;
  const first = body.data?.result?.[0]?.value?.[1];
  if (first === undefined) return null;
  const num = Number.parseFloat(first);
  return Number.isFinite(num) ? num : null;
}

export function useRangeQuery(
  query: string | null,
  range: TimeRange,
  refreshMs: number | null,
): { data: MatrixData | null; error: string | null; lastFetchedAt: number | null } {
  const [data, setData] = useState<MatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const seconds = range.seconds;
  const step = range.step;

  usePollingEffect(
    async () => {
      if (!query) return;
      try {
        const body = await fetchRange(query, { seconds, step });
        if (body.status !== 'success') {
          setError(body.error ?? 'prometheus error');
          return;
        }
        setData(body.data ?? null);
        setLastFetchedAt(Date.now());
        setError(null);
      } catch (err) {
        setError(errMessage(err));
      }
    },
    { refreshMs, deps: [query, seconds, step], enabled: !!query },
  );

  return { data, error, lastFetchedAt };
}

export function useInstantQuery(
  query: string,
  refreshMs: number | null,
): { data: number | null; error: string | null; lastFetchedAt: number | null } {
  const [data, setData] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  usePollingEffect(
    async () => {
      try {
        const v = await fetchInstant(query);
        setData(v);
        setLastFetchedAt(Date.now());
        setError(null);
      } catch (err) {
        setError(errMessage(err));
      }
    },
    { refreshMs, deps: [query] },
  );

  return { data, error, lastFetchedAt };
}

/**
 * Builds the queries object for the dashboard. Service names are sanitised
 * (allowlist-only chars) before interpolation — URL state is user-controlled
 * so without sanitising, a crafted `?svc=foo"})` would break out of the label
 * selector and inject arbitrary PromQL (review M3).
 */
export function buildQueries(services: string[]): Record<string, string> {
  const safe = sanitizeServiceNames(services);
  const svc = safe.length > 0 ? safe.join('|') : '.+';
  const m = (extra = '') =>
    `roviq_http_server_duration_milliseconds_count{exported_job=~"${svc}"${extra}}`;
  const b = (extra = '') =>
    `roviq_http_server_duration_milliseconds_bucket{exported_job=~"${svc}"${extra}}`;
  const s = (extra = '') =>
    `roviq_http_server_duration_milliseconds_sum{exported_job=~"${svc}"${extra}}`;
  return {
    requestRate: `sum by (http_method, http_route) (rate(${m()}[1m]))`,
    errorRate5xx: `sum by (http_method, http_route) (rate(${m(',http_status_code=~"5.."')}[1m]))`,
    latencyP50: `histogram_quantile(0.50, sum by (le) (rate(${b()}[1m])))`,
    latencyP95: `histogram_quantile(0.95, sum by (le) (rate(${b()}[1m])))`,
    latencyP99: `histogram_quantile(0.99, sum by (le) (rate(${b()}[1m])))`,
    totalRequests: `sum(${m()}) or vector(0)`,
    totalRequests5m: `sum(increase(${m()}[5m])) or vector(0)`,
    errorPct: `100 * sum(rate(${m(',http_status_code=~"5.."')}[5m])) / clamp_min(sum(rate(${m()}[5m])), 1) or vector(0)`,
    // Metric is already `_milliseconds_*` (OTel-named, ms unit). DON'T multiply
    // by 1000 — that gave microseconds and made the panel disagree with Grafana
    // by a factor of ~1000.
    avgResponseMs: `sum(rate(${s()}[5m])) / clamp_min(sum(rate(${m()}[5m])), 1) or vector(0)`,
    // Each sparkline now plots the SAME function as its parent stat over time,
    // so the small chart shows you how today's number got to where it is.
    // Sparklines that show something different from the parent stat are
    // confusing (looks like a mismatch with Grafana — they're really plotting
    // unrelated quantities).
    totalRequestsSpark: `sum(${m()})`,
    totalRequests5mSpark: `sum(increase(${m()}[5m]))`,
    avgResponseSpark: `sum(rate(${s()}[1m])) / clamp_min(sum(rate(${m()}[1m])), 1)`,
    eventBusEmit: 'sum by (subject_prefix) (rate(roviq_event_bus_emit_total[1m]))',
    eventBusFailed: 'sum by (subject_prefix) (rate(roviq_event_bus_emit_failed_total[1m]))',
  };
}

export function buildLatencyUnion(q: Record<string, string>): string {
  return (
    `label_replace(${q.latencyP50}, "quantile", "p50", "", "") or ` +
    `label_replace(${q.latencyP95}, "quantile", "p95", "", "") or ` +
    `label_replace(${q.latencyP99}, "quantile", "p99", "", "")`
  );
}
