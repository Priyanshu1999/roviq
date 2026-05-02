'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@roviq/ui';
import { Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authFetch } from '../_lib/auth-fetch';

interface ServiceFilterProps {
  selected: string[];
  onChange: (next: string[]) => void;
}

interface PromVectorResponse {
  status?: string;
  data?: { result: Array<{ metric: { exported_job?: string } }> };
}

export function ServiceFilter({ selected, onChange }: ServiceFilterProps) {
  const [services, setServices] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({
          endpoint: 'query',
          query: 'count by (exported_job) (roviq_http_server_duration_milliseconds_count)',
        });
        const res = await authFetch(`/api/metrics?${params}`);
        const body = (await res.json()) as PromVectorResponse;
        if (cancelled) return;
        const names = (body.data?.result ?? [])
          .map((r) => r.metric.exported_job)
          .filter((s): s is string => Boolean(s))
          .sort();
        setServices(names);
      } catch {
        // ignore — toolbar still functional, filter just won't list options
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (svc: string) => {
    if (selected.includes(svc)) {
      onChange(selected.filter((s) => s !== svc));
    } else {
      onChange([...selected, svc]);
    }
  };

  const label =
    selected.length === 0
      ? 'All services'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} services`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="size-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Filter by service</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {services.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No services found</div>
        ) : (
          services.map((svc) => (
            <DropdownMenuCheckboxItem
              key={svc}
              checked={selected.includes(svc)}
              onCheckedChange={() => toggle(svc)}
              onSelect={(e) => e.preventDefault()}
            >
              {svc}
            </DropdownMenuCheckboxItem>
          ))
        )}
        {selected.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Clear selection
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
