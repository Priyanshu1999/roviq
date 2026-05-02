'use client';

import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';
import { authFetch } from '../_lib/auth-fetch';
import { usePollingEffect } from '../_lib/polling';

interface PromAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: 'firing' | 'pending' | 'inactive';
  activeAt: string;
  value: string;
}

interface PromAlertsResponse {
  status?: string;
  data?: { alerts?: PromAlert[] };
  error?: string;
}

type Severity = 'critical' | 'warning' | 'info';

interface AlertsBannerProps {
  refreshMs: number | null;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'warning', 'info'];

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
};

const SEVERITY_ICON: Record<Severity, typeof AlertTriangle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function normalizeSeverity(raw: string | undefined): Severity {
  if (raw === 'critical' || raw === 'warning' || raw === 'info') return raw;
  return 'info';
}

function summarize(alert: PromAlert): string {
  return (
    alert.annotations.summary ??
    alert.annotations.description ??
    alert.labels.alertname ??
    'Unnamed alert'
  );
}

export function AlertsBanner({ refreshMs }: AlertsBannerProps) {
  const [alerts, setAlerts] = useState<PromAlert[]>([]);
  const [expanded, setExpanded] = useState<Record<Severity, boolean>>({
    critical: false,
    warning: false,
    info: false,
  });
  const [dismissed, setDismissed] = useState<Record<Severity, boolean>>({
    critical: false,
    warning: false,
    info: false,
  });

  usePollingEffect(
    async () => {
      try {
        const res = await authFetch('/api/alerts');
        const body = (await res.json()) as PromAlertsResponse;
        const all = body.data?.alerts ?? [];
        setAlerts(all.filter((a) => a.state === 'firing'));
      } catch {
        setAlerts([]);
      }
    },
    { refreshMs, deps: [] },
  );

  if (alerts.length === 0) return null;

  const grouped = new Map<Severity, PromAlert[]>();
  for (const alert of alerts) {
    const sev = normalizeSeverity(alert.labels.severity);
    const list = grouped.get(sev) ?? [];
    list.push(alert);
    grouped.set(sev, list);
  }

  const visible = SEVERITY_ORDER.filter((sev) => grouped.has(sev) && !dismissed[sev]);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((sev) => {
        const list = grouped.get(sev) ?? [];
        const Icon = SEVERITY_ICON[sev];
        const isOpen = expanded[sev];
        const names = list
          .map((a) => a.labels.alertname ?? 'unnamed')
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(', ');
        return (
          <div
            key={sev}
            className={`rounded-md border ${SEVERITY_STYLE[sev]}`}
            // allow-testid-literal: internal observability strip — severity is the discriminator, only used for component-local debugging.
            data-testid={`alerts-banner-${sev}`}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [sev]: !prev[sev] }))}
                className="flex flex-1 items-center gap-2 text-left text-xs font-medium"
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="shrink-0 uppercase tracking-wide">
                  {sev} ({list.length})
                </span>
                <span className="truncate font-normal opacity-90">{names}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissed((prev) => ({ ...prev, [sev]: true }))}
                className="shrink-0 rounded px-1.5 py-0.5 text-xs opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
                aria-label={`Dismiss ${sev} alerts`}
              >
                ×
              </button>
            </div>
            {isOpen ? (
              <ul className="border-t border-current/20 px-3 py-2 text-xs">
                {list.map((alert, idx) => {
                  const name = alert.labels.alertname ?? 'unnamed';
                  const key = `${name}-${alert.activeAt}-${idx}`;
                  return (
                    <li key={key} className="flex items-start gap-2 py-0.5">
                      <span className="font-mono font-semibold">{name}</span>
                      <span className="opacity-80">— {summarize(alert)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
