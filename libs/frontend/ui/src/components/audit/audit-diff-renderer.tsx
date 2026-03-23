'use client';

import { cn } from '@roviq/ui/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export interface AuditDiffRendererLabels {
  noChanges?: string;
  fieldsDeleted?: (count: number) => string;
  deletedSnapshot?: string;
}

export interface AuditDiffRendererProps {
  /** JSONB changes: { field: { old, new } } */
  changes: Record<string, { old: unknown; new: unknown }> | null;
  /** Determines rendering mode: CREATE (green), UPDATE (diff), DELETE (red, collapsible) */
  actionType: string;
  /** Optional labels for i18n — pass translated strings from next-intl */
  labels?: AuditDiffRendererLabels;
}

const REDACTED = '[REDACTED]';

/** Format a value for display */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** Check if a value is the [REDACTED] sentinel */
function isRedacted(value: unknown): boolean {
  return value === REDACTED;
}

/** Single field row in the diff table */
function DiffRow({
  field,
  oldValue,
  newValue,
  actionType,
}: {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  actionType: string;
}) {
  const oldRedacted = isRedacted(oldValue);
  const newRedacted = isRedacted(newValue);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2 text-sm font-medium text-muted-foreground align-top whitespace-nowrap">
        {field}
      </td>

      {/* Old value column — shown for UPDATE and DELETE */}
      {actionType !== 'CREATE' && (
        <td className="px-3 py-2 text-sm align-top">
          {oldRedacted ? (
            <RedactedBadge />
          ) : (
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5',
                'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
              )}
            >
              <pre className="whitespace-pre-wrap font-mono text-xs">{formatValue(oldValue)}</pre>
            </span>
          )}
        </td>
      )}

      {/* Arrow for UPDATE */}
      {actionType === 'UPDATE' && (
        <td className="px-1 py-2 text-muted-foreground text-center align-top">→</td>
      )}

      {/* New value column — shown for UPDATE and CREATE */}
      {actionType !== 'DELETE' && (
        <td className="px-3 py-2 text-sm align-top">
          {newRedacted ? (
            <RedactedBadge />
          ) : (
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5',
                'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300',
              )}
            >
              <pre className="whitespace-pre-wrap font-mono text-xs">{formatValue(newValue)}</pre>
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

function RedactedBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {REDACTED}
    </span>
  );
}

/**
 * Renders JSONB audit changes as a visual diff table.
 *
 * - UPDATE: old (red) → new (green) per changed field
 * - CREATE: all green (old=null)
 * - DELETE: all red, collapsible (can be large entity snapshot)
 * - [REDACTED]: plain text badge, no color
 * - null: shown as em-dash (—)
 */
export function AuditDiffRenderer({ changes, actionType, labels }: AuditDiffRendererProps) {
  const [expanded, setExpanded] = useState(false);

  if (!changes || Object.keys(changes).length === 0) {
    return (
      <span className="text-sm text-muted-foreground italic">
        {labels?.noChanges ?? 'No changes recorded'}
      </span>
    );
  }

  const entries = Object.entries(changes);
  const isDelete = actionType === 'DELETE';

  // DELETE: collapsible by default (can be large entity snapshot)
  if (isDelete && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="size-4" />
        <span>
          {labels?.fieldsDeleted
            ? labels.fieldsDeleted(entries.length)
            : `${entries.length} field${entries.length !== 1 ? 's' : ''} deleted`}
        </span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* Collapse header for DELETE */}
      {isDelete && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex w-full items-center gap-1 border-b border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className="size-3.5" />
          <span>{labels?.deletedSnapshot ?? 'Deleted entity snapshot'}</span>
        </button>
      )}

      <table className="w-full text-left">
        <thead className="sr-only">
          <tr>
            <th>Field</th>
            {actionType !== 'CREATE' && <th>Old value</th>}
            {actionType === 'UPDATE' && <th />}
            {actionType !== 'DELETE' && <th>New value</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, { old: oldVal, new: newVal }]) => (
            <DiffRow
              key={field}
              field={field}
              oldValue={oldVal}
              newValue={newVal}
              actionType={actionType}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
