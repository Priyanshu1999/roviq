'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@roviq/ui';
import { Copy, ExternalLink, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

interface PanelMenuProps {
  promQuery?: string;
  tracesQuery?: string;
  logsQuery?: string;
  grafanaUrl: string;
}

// Datasource UIDs are stable per Grafana provisioning (see
// docker/grafana/provisioning/datasources/datasources.yaml). They are
// what Grafana 13's Explore expects in the `datasource` field of each
// query — the type name alone (e.g. `'tempo'`) is NOT enough.
const PROM_UID = 'PBFA97CFB590B2093';
const TEMPO_UID = 'P214B5B846CF3925F';
const LOKI_UID = 'P8E80F9AEF21F6940';

interface ExplorePane {
  datasource: string;
  queries: Array<Record<string, unknown>>;
  range: { from: string; to: string };
}

/**
 * Builds a Grafana 13 Explore deep-link.
 *
 * Grafana 13 deprecated the legacy `?left=<json>` query param in favour of:
 *   /explore?schemaVersion=1&orgId=1&panes=<encoded>
 * where `panes` is `{ "<paneId>": ExplorePane }`. The legacy `left=` form
 * was silently dropping us at the homepage.
 *
 * Each query inside a pane MUST carry its own `datasource: { type, uid }`
 * field — Grafana ignores the pane-level datasource for query routing.
 */
function buildExploreUrl(grafanaUrl: string, props: PanelMenuProps): string {
  let pane: ExplorePane | null = null;
  if (props.promQuery !== undefined) {
    pane = {
      datasource: PROM_UID,
      queries: [
        {
          refId: 'A',
          expr: props.promQuery,
          datasource: { type: 'prometheus', uid: PROM_UID },
        },
      ],
      range: { from: 'now-1h', to: 'now' },
    };
  } else if (props.tracesQuery !== undefined) {
    pane = {
      datasource: TEMPO_UID,
      queries: [
        {
          refId: 'A',
          queryType: 'traceql',
          query: props.tracesQuery || '{}',
          datasource: { type: 'tempo', uid: TEMPO_UID },
        },
      ],
      range: { from: 'now-1h', to: 'now' },
    };
  } else if (props.logsQuery !== undefined) {
    pane = {
      datasource: LOKI_UID,
      queries: [
        {
          refId: 'A',
          expr: props.logsQuery,
          datasource: { type: 'loki', uid: LOKI_UID },
        },
      ],
      range: { from: 'now-1h', to: 'now' },
    };
  }
  if (!pane) return `${grafanaUrl}/explore?orgId=1`;

  // Pane-id key can be any short string; Grafana's UI generates random
  // 3-char keys. We use a deterministic prefix so the URL stays stable
  // across renders (avoids React `key` thrash if used as a key).
  const panes = { roviq: pane };
  const encoded = encodeURIComponent(JSON.stringify(panes));
  return `${grafanaUrl}/explore?schemaVersion=1&orgId=1&panes=${encoded}`;
}

export function PanelMenu(props: PanelMenuProps) {
  const exploreUrl = buildExploreUrl(props.grafanaUrl, props);
  const promQuery = props.promQuery;

  const handleCopy = async () => {
    if (promQuery === undefined) return;
    try {
      await navigator.clipboard.writeText(promQuery);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Panel menu">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={exploreUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 size-4" />
            Open in Grafana
          </a>
        </DropdownMenuItem>
        {promQuery !== undefined ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleCopy}>
              <Copy className="mr-2 size-4" />
              Copy PromQL
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
