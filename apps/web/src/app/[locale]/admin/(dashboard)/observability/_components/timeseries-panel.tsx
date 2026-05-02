'use client';

import { Skeleton } from '@roviq/ui';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { PALETTE, type TimeRange } from '../_lib/constants';
import { formatTime, reshapeMatrix, useRangeQuery } from '../_lib/prom';
import { PanelShell } from './panel-shell';

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), {
  ssr: false,
});
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then((m) => m.ReferenceLine), {
  ssr: false,
});
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });

type CompareOffset = '1d' | '7d';
const COMPARE_OFFSET_SECONDS: Record<CompareOffset, number> = {
  '1d': 86400,
  '7d': 604800,
};

interface Annotation {
  ts: number;
  label: string;
  color?: string;
}

interface TimeseriesPanelProps {
  title: string;
  query: string;
  range: TimeRange;
  refreshMs: number | null;
  legendKey: (m: Record<string, string>) => string;
  yUnit?: string;
  decimals?: number;
  className?: string;
  showLegend?: boolean;
  headerRight?: React.ReactNode;
  annotations?: Annotation[];
  compareOffset?: CompareOffset | null;
  description?: string;
}

export function TimeseriesPanel({
  title,
  query,
  range,
  refreshMs,
  legendKey,
  yUnit,
  decimals = 2,
  className,
  showLegend = true,
  headerRight,
  annotations = [],
  compareOffset = null,
  description,
}: TimeseriesPanelProps) {
  const { data: matrix, error, lastFetchedAt } = useRangeQuery(query, range, refreshMs);
  const compareKey = compareOffset ? `compare-${compareOffset}` : null;
  const compareQuery = compareOffset ? `sum((${query}) offset ${compareOffset})` : null;
  const { data: compareMatrix } = useRangeQuery(compareQuery, range, refreshMs);
  const data = useMemo(
    () => (matrix ? reshapeMatrix(matrix, legendKey) : null),
    [matrix, legendKey],
  );
  // Shift compare points forward by offset so they align under the main x-axis (today vs prior period).
  const compareShifted = useMemo(() => {
    if (!compareMatrix || !compareOffset) return null;
    const shift = COMPARE_OFFSET_SECONDS[compareOffset];
    const reshaped = reshapeMatrix(compareMatrix, () => 'value');
    const map = new Map<number, number>();
    for (const p of reshaped.points) map.set(p.ts + shift, p.value ?? 0);
    return map;
  }, [compareMatrix, compareOffset]);
  const mergedPoints = useMemo(() => {
    if (!data) return null;
    if (!compareShifted || !compareKey) return data.points;
    return data.points.map((p) => ({ ...p, [compareKey]: compareShifted.get(p.ts) ?? null }));
  }, [data, compareShifted, compareKey]);
  const gradId = `grad-${title.replace(/\W+/g, '-')}`;
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggleSeries = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <PanelShell
      title={title}
      className={className}
      headerRight={headerRight}
      lastFetchedAt={lastFetchedAt}
      description={description}
    >
      <div className="h-full min-h-[180px]">
        {error ? (
          <div className="flex h-full items-center justify-center text-xs text-destructive">
            {error}
          </div>
        ) : !data ? (
          <Skeleton className="h-full w-full" />
        ) : data.points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={mergedPoints ?? data.points}
              margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
            >
              <defs>
                {data.series.map((seriesKey, idx) => {
                  const c = PALETTE[idx % PALETTE.length];
                  return (
                    <linearGradient
                      key={`${gradId}-${seriesKey}`}
                      id={`${gradId}-${idx}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={c} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" />
              <XAxis
                dataKey="ts"
                tickFormatter={(ts) => formatTime(ts, range)}
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                minTickGap={40}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(v: number) =>
                  yUnit ? `${v.toFixed(decimals)} ${yUnit}` : v.toFixed(decimals)
                }
                width={56}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-popover)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  color: 'var(--color-popover-foreground)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--color-muted-foreground)' }}
                labelFormatter={(ts) =>
                  typeof ts === 'number' ? new Date(ts * 1000).toLocaleString() : String(ts)
                }
                formatter={(v) => {
                  const num = typeof v === 'number' ? v : Number.parseFloat(String(v));
                  const formatted = Number.isFinite(num) ? num.toFixed(decimals) : '–';
                  return `${formatted}${yUnit ? ` ${yUnit}` : ''}`;
                }}
                cursor={{
                  stroke: 'var(--color-muted-foreground)',
                  strokeWidth: 1,
                  strokeOpacity: 0.5,
                }}
              />
              {showLegend ? (
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 4, cursor: 'pointer' }}
                  iconType="plainline"
                  iconSize={14}
                  onClick={(entry) => {
                    // Recharts' onClick fires with `dataKey` = series key and
                    // `value` = whatever `formatter` returned. Our formatter
                    // wraps in a `<span>`, so `value` is a React element — never
                    // a string. Must read `dataKey` (review M5).
                    const key = (entry as { dataKey?: string }).dataKey;
                    if (typeof key === 'string') toggleSeries(key);
                  }}
                  formatter={(value: string) => (
                    <span
                      style={{
                        color: hidden.has(value) ? 'var(--color-muted-foreground)' : 'inherit',
                        textDecoration: hidden.has(value) ? 'line-through' : 'none',
                        opacity: hidden.has(value) ? 0.6 : 1,
                      }}
                    >
                      {value}
                    </span>
                  )}
                />
              ) : null}
              {data.series.map((key, idx) => (
                <Area
                  key={key}
                  type="linear"
                  dataKey={key}
                  hide={hidden.has(key)}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={1.5}
                  fill={`url(#${gradId}-${idx})`}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
              {compareKey ? (
                <Line
                  type="linear"
                  dataKey={compareKey}
                  name={`${compareKey} (${compareOffset} ago)`}
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={0}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                  hide={hidden.has(compareKey)}
                />
              ) : null}
              {annotations.map((a) => (
                <ReferenceLine
                  key={a.ts}
                  x={a.ts}
                  stroke={a.color ?? 'var(--color-primary)'}
                  strokeDasharray="4 4"
                  label={{
                    value: a.label,
                    position: 'top',
                    fontSize: 10,
                    fill: 'var(--color-muted-foreground)',
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </PanelShell>
  );
}
