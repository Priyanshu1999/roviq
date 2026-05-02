'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@roviq/ui';
import { Clock, ExternalLink, RefreshCw } from 'lucide-react';
import {
  REFRESH_INTERVALS,
  type RefreshInterval,
  TIME_RANGES,
  type TimeRange,
} from '../_lib/constants';
import { ServiceFilter } from './service-filter';

interface ToolbarProps {
  range: TimeRange;
  setRange: (r: TimeRange) => void;
  refresh: RefreshInterval;
  setRefresh: (r: RefreshInterval) => void;
  onRefreshNow: () => void;
  services: string[];
  setServices: (s: string[]) => void;
  grafanaUrl: string;
}

export function Toolbar({
  range,
  setRange,
  refresh,
  setRefresh,
  onRefreshNow,
  services,
  setServices,
  grafanaUrl,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ServiceFilter selected={services} onChange={setServices} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="size-4" />
            {range.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TIME_RANGES.map((r) => (
            <DropdownMenuItem key={r.shortLabel} onSelect={() => setRange(r)}>
              {r.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="size-4" />
            {refresh.label === 'Off' ? 'Auto-refresh: Off' : `Auto: ${refresh.label}`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {REFRESH_INTERVALS.map((r) => (
            <DropdownMenuItem key={r.label} onSelect={() => setRefresh(r)}>
              {r.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" onClick={onRefreshNow} aria-label="Refresh now">
        <RefreshCw className="size-4" />
      </Button>

      <div className="flex-1" />

      <Button variant="outline" size="sm" asChild className="gap-2">
        <a
          href={`${grafanaUrl}/d/roviq-overview?orgId=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="size-4" />
          Open in Grafana
        </a>
      </Button>
    </div>
  );
}
