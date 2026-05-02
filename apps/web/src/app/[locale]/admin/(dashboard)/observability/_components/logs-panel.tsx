'use client';

import { Skeleton } from '@roviq/ui';
import { useState } from 'react';
import { authFetch, errMessage, sanitizeServiceNames } from '../_lib/auth-fetch';
import type { TimeRange } from '../_lib/constants';
import { METRIC_INFO } from '../_lib/metric-descriptions';
import { usePollingEffect } from '../_lib/polling';
import { PanelShell } from './panel-shell';

interface LokiStream {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

interface LokiQueryResponse {
  status?: string;
  data?: { resultType: string; result: LokiStream[] };
  error?: string;
}

interface LogLine {
  ts: number;
  level: string;
  service: string;
  message: string;
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-500',
  warn: 'text-amber-500',
  info: 'text-sky-500',
  debug: 'text-muted-foreground',
};

interface RecentLogsPanelProps {
  range: TimeRange;
  refreshMs: number | null;
  services: string[];
  className?: string;
  headerRight?: React.ReactNode;
}

function flattenStreams(result: LokiStream[]): LogLine[] {
  const flat: LogLine[] = [];
  for (const stream of result) {
    for (const [tsNano, raw] of stream.values) {
      let level = stream.stream.level ?? 'info';
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { level?: string; msg?: string; message?: string };
        if (parsed.level) level = parsed.level;
        if (parsed.msg ?? parsed.message) message = (parsed.msg ?? parsed.message) as string;
      } catch {
        // non-JSON line, keep raw
      }
      flat.push({
        ts: Math.floor(Number(tsNano) / 1_000_000),
        level: level.toLowerCase(),
        service: stream.stream.exported_job ?? stream.stream.service_name ?? '–',
        message,
      });
    }
  }
  flat.sort((a, b) => b.ts - a.ts);
  return flat.slice(0, 100);
}

export function RecentLogsPanel({
  range,
  refreshMs,
  services,
  className,
  headerRight,
}: RecentLogsPanelProps) {
  const [logs, setLogs] = useState<LogLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const sinceSeconds = range.seconds;
  // Sanitised so the user-controlled URL state can't inject LogQL (review M3).
  const sanitised = sanitizeServiceNames(services);
  const svcRegex = sanitised.length > 0 ? sanitised.join('|') : '.+';

  usePollingEffect(
    async () => {
      try {
        const params = new URLSearchParams({
          query: `{exported_job=~"${svcRegex}"}`,
          limit: '50',
          sinceSeconds: String(sinceSeconds),
        });
        const res = await authFetch(`/api/logs?${params}`);
        const body = (await res.json()) as LokiQueryResponse;
        if (body.status !== 'success') {
          setError(body.error ?? 'loki error');
          return;
        }
        setLogs(flattenStreams(body.data?.result ?? []));
        setLastFetchedAt(Date.now());
        setError(null);
      } catch (err) {
        setError(errMessage(err));
      }
    },
    { refreshMs, deps: [sinceSeconds, svcRegex] },
  );

  return (
    <PanelShell
      title={METRIC_INFO.recentLogs.title}
      description={METRIC_INFO.recentLogs.description}
      className={className}
      headerRight={headerRight}
      lastFetchedAt={lastFetchedAt}
    >
      <div className="h-full max-h-[360px] min-h-[180px] overflow-auto font-mono text-[11px]">
        {error ? (
          <div className="flex h-full items-center justify-center text-xs text-destructive">
            {error}
          </div>
        ) : !logs ? (
          <Skeleton className="h-full w-full" />
        ) : logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No logs in this range
          </div>
        ) : (
          <ul className="space-y-0.5">
            {logs.map((line) => (
              <li
                key={`${line.ts}-${line.message.slice(0, 24)}`}
                className="flex gap-2 border-b border-border/40 px-1 py-1 last:border-0"
              >
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {new Date(line.ts).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span
                  className={`w-12 shrink-0 uppercase ${LOG_LEVEL_COLORS[line.level] ?? 'text-muted-foreground'}`}
                >
                  {line.level}
                </span>
                <span className="shrink-0 text-muted-foreground">[{line.service}]</span>
                <span className="break-all">{line.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  );
}
