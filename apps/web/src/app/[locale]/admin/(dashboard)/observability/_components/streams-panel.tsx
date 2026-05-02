'use client';

import { Info } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { TimeRange } from '../_lib/constants';
import { METRIC_INFO } from '../_lib/metric-descriptions';
import { reshapeMatrix, useInstantQuery, useRangeQuery } from '../_lib/prom';
import { PanelShell } from './panel-shell';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });

interface StreamsPanelProps {
  range: TimeRange;
  refreshMs: number | null;
}

// PromQL fragment that lists every stream Prometheus has seen messages-gauge data for.
// Metric prefix is `jetstream_*` (from `prometheus-nats-exporter` which scrapes the
// NATS server's built-in `:8222/jsz` endpoint) — NOT the older `nats_jetstream_*` prefix.
const STREAM_DISCOVERY_QUERY = 'count by (stream_name) (jetstream_stream_total_messages)';

export function StreamsPanel({ range, refreshMs }: StreamsPanelProps) {
  const {
    data: discovery,
    error,
    lastFetchedAt,
  } = useRangeQuery(STREAM_DISCOVERY_QUERY, range, refreshMs);

  const streams = useMemo<string[]>(() => {
    if (!discovery?.result?.length) return [];
    const names = new Set<string>();
    for (const row of discovery.result) {
      const name = row.metric.stream_name;
      if (name) names.add(name);
    }
    return [...names].sort();
  }, [discovery]);

  const isLoading = discovery === null && error === null;
  const isEmpty = !isLoading && error === null && streams.length === 0;

  return (
    <PanelShell
      title={METRIC_INFO.jetstreamStreams.title}
      description={METRIC_INFO.jetstreamStreams.description}
      lastFetchedAt={lastFetchedAt}
    >
      {error ? (
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-xs text-destructive">
          {error}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[160px] animate-pulse rounded-md border bg-muted/30" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {streams.map((name) => (
            <StreamCard key={name} name={name} range={range} refreshMs={refreshMs} />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      <Info className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <div className="text-sm font-medium">No JetStream metrics found in Prometheus</div>
      <div className="max-w-md text-xs text-muted-foreground">
        Prometheus is not currently scraping any{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">nats_jetstream_*</code> series.
        Add a{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">prometheus-nats-exporter</code>{' '}
        scrape target (or enable NATS&rsquo; built-in Prometheus endpoint) and JetStream streams
        will appear here automatically.
      </div>
    </div>
  );
}

interface StreamCardProps {
  name: string;
  range: TimeRange;
  refreshMs: number | null;
}

function StreamCard({ name, range, refreshMs }: StreamCardProps) {
  const filter = `{stream_name="${name}"}`;
  // Metric names match the prometheus-nats-exporter output (`-jsz=all` flag).
  // sum(...) is needed because each stream has multiple label dimensions
  // (server_id, account, …) and we want a single number per stream.
  const { data: messages } = useInstantQuery(
    `sum(jetstream_stream_total_messages${filter})`,
    refreshMs,
  );
  const { data: bytes } = useInstantQuery(`sum(jetstream_stream_total_bytes${filter})`, refreshMs);
  const { data: consumers } = useInstantQuery(
    `sum(jetstream_stream_consumer_count${filter})`,
    refreshMs,
  );
  const { data: pending } = useInstantQuery(
    `sum(jetstream_consumer_num_pending${filter})`,
    refreshMs,
  );
  const { data: maxPending } = useInstantQuery(
    `max(jetstream_consumer_num_pending${filter})`,
    refreshMs,
  );
  const { data: redelivered5m } = useInstantQuery(
    `sum(increase(jetstream_consumer_num_redelivered${filter}[5m]))`,
    refreshMs,
  );
  const { data: rateMatrix } = useRangeQuery(
    `sum(rate(jetstream_stream_total_messages${filter}[1m]))`,
    range,
    refreshMs,
  );
  const spark = useMemo(
    () => (rateMatrix ? reshapeMatrix(rateMatrix, () => 'v') : null),
    [rateMatrix],
  );
  const hasSpark = spark !== null && spark.points.length > 0;

  const health = computeHealth(maxPending, redelivered5m);

  return (
    <div className="flex flex-col rounded-md border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <StreamHealthBadge level={health} />
        <span className="flex-1 truncate text-base font-semibold" title={name}>
          {name}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{formatCount(messages)}</span>
        <span className="text-xs text-muted-foreground">messages</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Bytes" value={formatBytes(bytes)} />
        <Stat label="Consumers" value={formatCount(consumers)} />
        <Stat label="Pending" value={formatCount(pending)} />
      </dl>
      {hasSpark && spark ? (
        <div className="mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.points} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.2}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-2 h-10" aria-hidden="true" />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}

type HealthLevel = 'green' | 'amber' | 'red';

function computeHealth(maxPending: number | null, redelivered5m: number | null): HealthLevel {
  if ((redelivered5m ?? 0) > 0) return 'red';
  if ((maxPending ?? 0) >= 100) return 'red';
  if ((maxPending ?? 0) > 0) return 'amber';
  return 'green';
}

function StreamHealthBadge({ level }: { level: HealthLevel }) {
  const color =
    level === 'green' ? 'bg-green-500' : level === 'amber' ? 'bg-amber-500' : 'bg-red-500';
  const label =
    level === 'green' ? 'Healthy' : level === 'amber' ? 'Pending messages' : 'Unhealthy';
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
    />
  );
}

function formatCount(v: number | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toString();
}

function formatBytes(v: number | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} GB`;
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(2)} MB`;
  if (v >= 1024) return `${(v / 1024).toFixed(2)} KB`;
  return `${Math.round(v)} B`;
}
