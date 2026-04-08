'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface CapacityBarProps {
  current: number;
  capacity: number;
  /** Hard maximum (e.g., 45 for CBSE). If exceeded, shows red. */
  hardMax?: number;
  /** Whether to show the tooltip with exact numbers */
  showTooltip?: boolean;
  className?: string;
}

/**
 * Section capacity progress bar with color coding:
 * - Green: strength < 80% capacity
 * - Amber: 80-100% capacity
 * - Red: >100% capacity or > hard_max
 */
export function CapacityBar({
  current,
  capacity,
  hardMax,
  showTooltip = true,
  className = '',
}: CapacityBarProps) {
  const percentage = capacity > 0 ? Math.round((current / capacity) * 100) : 0;
  const fillWidth = Math.min(percentage, 100);
  const isOverHardMax = hardMax ? current > hardMax : false;

  let barColor = 'bg-emerald-500';
  if (isOverHardMax || percentage > 100) {
    barColor = 'bg-red-500';
  } else if (percentage >= 80) {
    barColor = 'bg-amber-500';
  }

  const bar = (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={capacity}
        data-testid="capacity-bar"
        data-state={isOverHardMax || percentage > 100 ? 'over' : percentage >= 80 ? 'warn' : 'ok'}
        className="h-2 flex-1 rounded-full bg-muted overflow-hidden"
      >
        <div
          data-testid="capacity-bar-fill"
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {current}/{capacity}
      </span>
    </div>
  );

  if (!showTooltip) return bar;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{bar}</TooltipTrigger>
      <TooltipContent>
        <p>
          {current}/{capacity} students ({percentage}%)
          {isOverHardMax && ` — exceeds hard max of ${hardMax}`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
