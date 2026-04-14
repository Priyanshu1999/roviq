'use client';

import { cn } from '@roviq/ui/lib/utils';
import { ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { AuditDiffRenderer } from './audit-diff-renderer';

// ── Types ────────────────────────────────────────────

export interface EntityTimelineProps {
  /** Entity type to filter by (e.g. 'Student', 'Section') */
  entityType: string;
  /** Entity UUID */
  entityId: string;
  /** Number of events to load initially and per page (default 10) */
  initialLimit?: number;
  /** Translation function — pass useTranslations('auditLogs') from next-intl */
  t: (key: string, values?: Record<string, unknown>) => string;
  /** Date formatter — pass format from useFormatDate() */
  formatDate: (date: Date | number, formatStr: string) => string;
  /** Query hook result — decouples from Apollo so component is framework-agnostic */
  data: EntityTimelineData | undefined;
  /** Whether data is loading */
  loading: boolean;
  /** Whether more pages are available */
  hasNextPage: boolean;
  /** Callback to load next page — should return a Promise for loading state */
  onLoadMore: () => void | Promise<void>;
  /** Whether user has read:AuditLog permission (from <Can> or ability.can()) */
  canRead: boolean;
  /** Optional data-testid for the empty state element. */
  emptyStateTestId?: string;
}

export interface EntityTimelineEvent {
  id: string;
  action: string;
  actionType: string;
  entityType: string;
  createdAt: string;
  actorName: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
}

export interface EntityTimelineData {
  events: EntityTimelineEvent[];
  totalCount: number;
}

// ── Action type → color mapping ──────────────────────

const actionColors: Record<string, string> = {
  /** New entity created */
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  /** Existing entity modified */
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  /** Entity soft-deleted */
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  /** Entity restored from trash */
  RESTORE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  /** Role/permission assigned */
  ASSIGN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  /** Role/permission revoked */
  REVOKE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  /** Entity suspended */
  SUSPEND: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  /** Entity re-activated */
  ACTIVATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const dotColors: Record<string, string> = {
  CREATE: 'bg-green-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-red-500',
  RESTORE: 'bg-amber-500',
  ASSIGN: 'bg-purple-500',
  REVOKE: 'bg-orange-500',
  SUSPEND: 'bg-red-500',
  ACTIVATE: 'bg-green-500',
};

// ── Sub-components ───────────────────────────────────

function TimelineItem({
  event,
  t,
  formatDate,
}: {
  event: EntityTimelineEvent;
  t: EntityTimelineProps['t'];
  formatDate: EntityTimelineProps['formatDate'];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = event.changes && Object.keys(event.changes).length > 0;
  const dotColor = dotColors[event.actionType] ?? 'bg-muted-foreground';
  const badgeColor = actionColors[event.actionType] ?? '';

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={cn('size-3 rounded-full mt-1.5 shrink-0', dotColor)} />
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 -mt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn('text-xs font-normal border-transparent', badgeColor)}
          >
            {t(`actionTypes.${event.actionType}`) || event.actionType}
          </Badge>
          <span className="text-sm font-medium text-foreground">{event.action}</span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3" />
          <time>{formatDate(new Date(event.createdAt), 'PPp')}</time>
          {event.actorName && (
            <>
              <span>·</span>
              <span>{event.actorName}</span>
            </>
          )}
        </div>

        {/* Collapsible changes */}
        {hasChanges && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {t('detail.changes')}
            </button>
            {expanded && (
              <div className="mt-1.5">
                <AuditDiffRenderer changes={event.changes} actionType={event.actionType} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="w-px flex-1 mt-1" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────

/**
 * Reusable entity audit timeline — shows chronological audit history
 * for a specific entity. Embeddable in any entity detail page.
 *
 * Wraps all content behind a `canRead` prop for graceful degradation
 * when user lacks read:AuditLog permission.
 */
export function EntityTimeline({
  t,
  formatDate,
  data,
  loading,
  hasNextPage,
  onLoadMore,
  canRead,
  emptyStateTestId,
}: EntityTimelineProps) {
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }, [onLoadMore]);

  // Graceful degradation — render nothing if user can't read audit logs
  if (!canRead) return null;

  if (loading && !data) {
    return <TimelineSkeleton />;
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground" data-testid={emptyStateTestId}>
          {t('entityTimeline.noHistory')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.events.map((event) => (
        <TimelineItem key={event.id} event={event} t={t} formatDate={formatDate} />
      ))}

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('pagination.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
