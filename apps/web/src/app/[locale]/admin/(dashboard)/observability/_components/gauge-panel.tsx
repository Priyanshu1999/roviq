'use client';

import { arcPath } from '../_lib/arc';
import { useInstantQuery } from '../_lib/prom';
import { PanelShell } from './panel-shell';

interface Threshold {
  value: number;
  color: string;
}

interface GaugePanelProps {
  title: string;
  query: string;
  refreshMs: number | null;
  thresholds?: Threshold[];
  min?: number;
  max?: number;
  unit?: string;
  className?: string;
  headerRight?: React.ReactNode;
  description?: string;
}

const DEFAULT_THRESHOLDS: Threshold[] = [
  { value: 0, color: '#73BF69' },
  { value: 1, color: '#F2CC0C' },
  { value: 5, color: '#F2495C' },
];

export function GaugePanel({
  title,
  query,
  refreshMs,
  thresholds = DEFAULT_THRESHOLDS,
  min = 0,
  max = 100,
  unit = '%',
  className,
  headerRight,
  description,
}: GaugePanelProps) {
  const { data: value, error, lastFetchedAt } = useInstantQuery(query, refreshMs);
  const v = value ?? 0;
  const clamped = Math.min(Math.max(v, min), max);
  const t = (clamped - min) / (max - min);

  const activeBand = [...thresholds].reverse().find((thr) => v >= thr.value) ?? thresholds[0];

  const cx = 100;
  const cy = 100;
  const r = 76;
  const stroke = 16;

  return (
    <PanelShell
      title={title}
      className={className}
      headerRight={headerRight}
      lastFetchedAt={lastFetchedAt}
      description={description}
    >
      <div className="relative flex h-full min-h-[120px] flex-col items-center justify-center">
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : (
          <svg
            viewBox="0 0 200 120"
            className="w-full max-w-[220px]"
            role="img"
            aria-label={`${title} gauge`}
          >
            <title>{title}</title>
            <path
              d={arcPath(cx, cy, r, 0, 1)}
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            {value !== null && t > 0 ? (
              <path
                d={arcPath(cx, cy, r, 0, t)}
                fill="none"
                stroke={activeBand.color}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
            ) : null}
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={28}
              fontWeight={600}
              fill={activeBand.color}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {value === null ? '–' : `${v.toFixed(1)}${unit}`}
            </text>
            <text
              x={cx - r}
              y={cy + 16}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-muted-foreground)"
            >
              {min}
              {unit}
            </text>
            <text
              x={cx + r}
              y={cy + 16}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-muted-foreground)"
            >
              {max}
              {unit}
            </text>
          </svg>
        )}
      </div>
    </PanelShell>
  );
}
