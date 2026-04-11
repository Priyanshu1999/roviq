'use client';

/**
 * Reusable entity audit timeline widget — self-contained Apollo query wrapper
 * around the framework-agnostic <EntityTimeline> base in ../audit.
 *
 * Drop this into any detail page with `<EntityTimeline entityType="Student" entityId={id} />`
 * and it will render the audit trail filtered to that entity, with load-more
 * pagination and built-in permission gating via CASL.
 *
 * This file ONLY renders the list — the base component (../audit/entity-timeline.tsx)
 * still owns the actual item rendering so we don't duplicate diff rendering.
 */

import { gql, useQuery } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import { useTranslations } from 'next-intl';
import {
  EntityTimeline as BaseEntityTimeline,
  type EntityTimelineData,
} from '../audit/entity-timeline';
import { useAbility } from '../auth/ability-provider';

// ── Query ─────────────────────────────────────────────

const AUDIT_LOGS_FOR_ENTITY = gql`
  query EntityTimelineAuditLogs($filter: AuditLogFilterInput, $first: Int, $after: String) {
    auditLogs(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          action
          actionType
          entityType
          actorName
          changes
          metadata
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

// ── Types ─────────────────────────────────────────────

export interface EntityTimelineWidgetProps {
  /** Entity type to filter by (e.g. 'Student', 'Section'). */
  entityType: string;
  /** Entity UUID to filter by. */
  entityId: string;
  /** Initial page size — default 10. */
  initialLimit?: number;
  /** Optional data-test-id for the empty state element. */
  emptyStateTestId?: string;
}

interface AuditLogNode {
  id: string;
  action: string;
  actionType: string;
  entityType: string;
  actorName: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogsResponse {
  auditLogs: {
    edges: Array<{ cursor: string; node: AuditLogNode }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    totalCount: number;
  };
}

// ── Component ─────────────────────────────────────────

/**
 * Self-contained entity audit timeline that runs its own Apollo query.
 * Uses the framework-agnostic `BaseEntityTimeline` for rendering, and
 * handles loading / pagination / permission gating internally.
 */
export function EntityTimeline({
  entityType,
  entityId,
  initialLimit = 10,
  emptyStateTestId,
}: EntityTimelineWidgetProps) {
  const t = useTranslations('auditLogs');
  const { format } = useFormatDate();
  const ability = useAbility();
  const canRead = ability.can('read', 'AuditLog');

  const { data, loading, fetchMore } = useQuery<AuditLogsResponse>(AUDIT_LOGS_FOR_ENTITY, {
    variables: {
      filter: { entityType, entityId },
      first: initialLimit,
    },
    skip: !canRead || !entityId,
    notifyOnNetworkStatusChange: true,
  });

  const timelineData: EntityTimelineData | undefined = data
    ? {
        events: data.auditLogs.edges.map((e) => e.node),
        totalCount: data.auditLogs.totalCount,
      }
    : undefined;

  const hasNextPage = data?.auditLogs.pageInfo.hasNextPage ?? false;

  const handleLoadMore = async () => {
    const endCursor = data?.auditLogs.pageInfo.endCursor;
    if (!endCursor) return;
    await fetchMore({
      variables: {
        filter: { entityType, entityId },
        first: initialLimit,
        after: endCursor,
      },
    });
  };

  // Wrap next-intl's `Translator` in a plain `(key, values) => string` so
  // it matches the framework-agnostic signature `BaseEntityTimeline` expects.
  // next-intl restricts placeholder values to `string | number | Date`;
  // narrow the unknown values from the base interface to that subset before
  // passing through. Any value the audit log surfaces (action names, dates,
  // counts) already conforms.
  const translate = (key: string, values?: Record<string, unknown>): string => {
    if (!values) return t(key);
    const narrowed: Record<string, string | number | Date> = {};
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) {
        narrowed[k] = v;
      } else {
        narrowed[k] = String(v);
      }
    }
    return t(key, narrowed);
  };

  return (
    <BaseEntityTimeline
      entityType={entityType}
      entityId={entityId}
      t={translate}
      formatDate={format}
      data={timelineData}
      loading={loading}
      hasNextPage={hasNextPage}
      onLoadMore={handleLoadMore}
      canRead={canRead}
      emptyStateTestId={emptyStateTestId}
    />
  );
}
