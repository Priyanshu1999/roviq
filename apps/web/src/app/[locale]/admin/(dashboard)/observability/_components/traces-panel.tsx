'use client';

import { Skeleton } from '@roviq/ui';
import { useState } from 'react';
import { authFetch, errMessage, sanitizeServiceNames } from '../_lib/auth-fetch';
import type { TimeRange } from '../_lib/constants';
import { METRIC_INFO } from '../_lib/metric-descriptions';
import { usePollingEffect } from '../_lib/polling';
import { PanelShell } from './panel-shell';

// Tempo datasource UID — see _components/panel-menu.tsx for why we hardcode UIDs.
const TEMPO_UID = 'P214B5B846CF3925F';

function buildTempoTraceUrl(grafanaUrl: string, traceId: string): string {
  const panes = {
    roviq: {
      datasource: TEMPO_UID,
      queries: [
        {
          refId: 'A',
          queryType: 'traceql',
          query: traceId,
          datasource: { type: 'tempo', uid: TEMPO_UID },
        },
      ],
      range: { from: 'now-1h', to: 'now' },
    },
  };
  return `${grafanaUrl}/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;
}

interface TempoTrace {
  traceID: string;
  rootServiceName?: string;
  rootTraceName?: string;
  startTimeUnixNano?: string;
  durationMs?: number;
}

interface TempoSearchResponse {
  traces?: TempoTrace[];
  error?: string;
}

interface RecentTracesPanelProps {
  range: TimeRange;
  refreshMs: number | null;
  services: string[];
  className?: string;
  grafanaUrl: string;
  headerRight?: React.ReactNode;
}

export function RecentTracesPanel({
  range,
  refreshMs,
  services,
  className,
  grafanaUrl,
  headerRight,
}: RecentTracesPanelProps) {
  const [traces, setTraces] = useState<TempoTrace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const sinceSeconds = range.seconds;
  // Sanitised so the user-controlled URL state can't inject TraceQL (review M3).
  const safeServiceRegex = sanitizeServiceNames(services).join('|');

  usePollingEffect(
    async () => {
      try {
        const params = new URLSearchParams({
          // Over-fetch so we still have ~20 to show after the noise filter.
          limit: '60',
          sinceSeconds: String(sinceSeconds),
        });
        // Always filter out noise that crowds out real traffic — Docker
        // compose healthcheck pings, the api-gateway's own /api/health,
        // GraphQL introspection (codegen). User asked for these specifically.
        const noiseExclusions = [
          'resource.service.name != "compose"',
          'name != "GET /api/health"',
          'name != "HEAD /_ping"',
          'name != "query IntrospectionQuery"',
        ];
        const clauses = safeServiceRegex
          ? [`resource.service.name=~"${safeServiceRegex}"`, ...noiseExclusions]
          : noiseExclusions;
        params.set('q', `{ ${clauses.join(' && ')} }`);

        const res = await authFetch(`/api/traces?${params}`);
        const body = (await res.json()) as TempoSearchResponse;
        if (body.error) {
          setError(body.error);
          return;
        }
        setTraces((body.traces ?? []).slice(0, 20));
        setLastFetchedAt(Date.now());
        setError(null);
      } catch (err) {
        setError(errMessage(err));
      }
    },
    { refreshMs, deps: [sinceSeconds, safeServiceRegex] },
  );

  return (
    <PanelShell
      title={METRIC_INFO.recentTraces.title}
      description={METRIC_INFO.recentTraces.description}
      className={className}
      headerRight={headerRight}
      lastFetchedAt={lastFetchedAt}
    >
      <div className="h-full max-h-[360px] min-h-[180px] overflow-auto">
        {error ? (
          <div className="flex h-full items-center justify-center text-xs text-destructive">
            {error}
          </div>
        ) : !traces ? (
          <Skeleton className="h-full w-full" />
        ) : traces.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No traces in this range
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left font-medium">Service</th>
                <th className="px-2 py-1.5 text-left font-medium">Trace</th>
                <th className="px-2 py-1.5 text-right font-medium">Duration</th>
                <th className="px-2 py-1.5 text-right font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => {
                const startedMs = trace.startTimeUnixNano
                  ? Math.floor(Number(trace.startTimeUnixNano) / 1_000_000)
                  : 0;
                const startedAt = startedMs
                  ? new Date(startedMs).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '–';
                return (
                  <tr key={trace.traceID} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-2 py-1.5 font-mono text-[11px]">
                      {trace.rootServiceName ?? '–'}
                    </td>
                    <td className="truncate px-2 py-1.5">
                      <a
                        href={buildTempoTraceUrl(grafanaUrl, trace.traceID)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {trace.rootTraceName ?? trace.traceID.slice(0, 16)}
                      </a>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {trace.durationMs ? `${trace.durationMs} ms` : '–'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {startedAt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PanelShell>
  );
}
