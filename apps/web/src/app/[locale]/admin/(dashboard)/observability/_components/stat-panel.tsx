'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { TimeRange } from '../_lib/constants';
import { formatTime, reshapeMatrix, useInstantQuery, useRangeQuery } from '../_lib/prom';
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

interface StatPanelProps {
  title: string;
  query: string;
  range: TimeRange;
  refreshMs: number | null;
  decimals?: number;
  unit?: string;
  color?: string;
  sparklineQuery?: string;
  className?: string;
  headerRight?: React.ReactNode;
  description?: string;
}

export function StatPanel({
  title,
  query,
  range,
  refreshMs,
  decimals = 0,
  unit,
  color = '#73BF69',
  sparklineQuery,
  className,
  headerRight,
  description,
}: StatPanelProps) {
  const { data: value, error, lastFetchedAt } = useInstantQuery(query, refreshMs);
  const { data: sparkMatrix } = useRangeQuery(sparklineQuery ?? null, range, refreshMs);
  const spark = useMemo(
    () => (sparkMatrix ? reshapeMatrix(sparkMatrix, () => 'v') : null),
    [sparkMatrix],
  );
  const [expanded, setExpanded] = useState<boolean>(false);

  const display =
    value === null || value === undefined
      ? '–'
      : `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;

  const hasSpark = spark !== null && spark.points.length > 0;
  const isClickable = sparklineQuery !== undefined;
  const toggle = () => {
    if (isClickable) setExpanded((v) => !v);
  };

  return (
    <PanelShell
      title={title}
      className={className}
      headerRight={headerRight}
      lastFetchedAt={lastFetchedAt}
      description={description}
    >
      <div className="relative flex h-full min-h-[120px] flex-col">
        <button
          type="button"
          onClick={isClickable ? toggle : undefined}
          disabled={!isClickable}
          aria-expanded={expanded}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md border-0 bg-transparent p-2 text-inherit ${
            isClickable ? 'cursor-pointer transition-colors hover:bg-muted/30' : 'cursor-default'
          }`}
        >
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : (
            <>
              <span
                className="text-4xl font-semibold tabular-nums"
                style={{ color: value === null ? 'var(--color-muted-foreground)' : color }}
              >
                {display}
              </span>
              {isClickable ? (
                expanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )
              ) : null}
            </>
          )}
        </button>
        {hasSpark && spark ? (
          expanded ? (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark.points} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
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
                      unit ? `${v.toFixed(decimals)} ${unit}` : v.toFixed(decimals)
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
                      return `${formatted}${unit ? ` ${unit}` : ''}`;
                    }}
                    cursor={{
                      stroke: 'var(--color-muted-foreground)',
                      strokeWidth: 1,
                      strokeOpacity: 0.5,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.25}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark.points} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.25}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )
        ) : null}
      </div>
    </PanelShell>
  );
}
