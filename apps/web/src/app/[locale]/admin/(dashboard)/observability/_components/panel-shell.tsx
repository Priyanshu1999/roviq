'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@roviq/ui';
import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PanelShellProps {
  title: string;
  className?: string;
  children: React.ReactNode;
  /** Right-aligned slot in the header bar — used for per-panel menus, status, etc. */
  headerRight?: React.ReactNode;
  /**
   * Epoch ms of the last successful upstream fetch. When provided, panels can pass
   * this through and a downstream feature can render an "Updated Xs ago" indicator
   * inside the header. Read by feature #4 (lastFetched timestamp).
   */
  lastFetchedAt?: number | null;
  /**
   * What this panel actually plots. When provided, an `(i)` icon is rendered
   * next to the title with this text as a hover tooltip. Source-of-truth lives
   * in `_lib/metric-descriptions.ts` and is mirrored into the Grafana dashboard
   * JSON so the wording is the same in both places.
   */
  description?: string;
}

export function PanelShell({
  title,
  className,
  children,
  headerRight,
  lastFetchedAt,
  description,
}: PanelShellProps) {
  return (
    <div
      className={`flex flex-col rounded-md border bg-card text-card-foreground shadow-sm ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
        <span className="truncate">{title}</span>
        {description ? <PanelInfoTooltip text={description} /> : null}
        <span className="flex-1" />
        {lastFetchedAt !== undefined && lastFetchedAt !== null ? (
          <LastFetchedAt ts={lastFetchedAt} />
        ) : null}
        {headerRight}
      </div>
      <div className="flex-1 px-2 pb-2 pt-3">{children}</div>
    </div>
  );
}

function PanelInfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Panel info"
            className="-mx-0.5 inline-flex shrink-0 cursor-help items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Tiny standalone component so feature #4 can replace this implementation
 * (e.g. to add a live-updating "8s ago" tick) without changing PanelShell.
 */
function LastFetchedAt({ ts }: { ts: number }) {
  // Force a re-render every 10s so the relative age string stays fresh
  // even when the parent doesn't re-render between upstream fetches.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const ageSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const label =
    ageSec < 60
      ? `${ageSec}s ago`
      : ageSec < 3600
        ? `${Math.floor(ageSec / 60)}m ago`
        : `${Math.floor(ageSec / 3600)}h ago`;
  return (
    <span
      className="text-[10px] font-normal text-muted-foreground tabular-nums"
      title={new Date(ts).toLocaleString()}
    >
      Updated {label}
    </span>
  );
}
