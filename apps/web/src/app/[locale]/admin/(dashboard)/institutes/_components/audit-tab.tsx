'use client';

import { gql, useQuery } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import type { EntityTimelineData } from '@roviq/ui';
import { Card, CardContent, CardHeader, CardTitle, EntityTimelineBase } from '@roviq/ui';
import { useTranslations } from 'next-intl';

const ADMIN_INSTITUTE_AUDIT_LOGS = gql`
  query AdminInstituteAuditLogs($tenantId: ID!, $first: Int, $after: String) {
    adminAuditLogs(filter: { tenantId: $tenantId }, first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          action
          actionType
          entityType
          entityId
          createdAt
          actorName
          changes
          metadata
        }
      }
    }
  }
`;

interface AuditEvent {
  id: string;
  action: string;
  actionType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actorName: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
}

interface Data {
  adminAuditLogs: {
    totalCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ cursor: string; node: AuditEvent }>;
  };
}

export function InstituteAuditTab({ instituteId }: { instituteId: string }) {
  const t = useTranslations('auditLogs');
  const tTab = useTranslations('adminInstitutes.audit');
  const { format } = useFormatDate();
  const { data, loading, fetchMore } = useQuery<Data>(ADMIN_INSTITUTE_AUDIT_LOGS, {
    variables: { tenantId: instituteId, first: 20 },
    fetchPolicy: 'cache-and-network',
  });

  const timelineData: EntityTimelineData | undefined = data
    ? {
        totalCount: data.adminAuditLogs.totalCount,
        events: data.adminAuditLogs.edges.map((e) => e.node),
      }
    : undefined;

  const handleLoadMore = async () => {
    const endCursor = data?.adminAuditLogs.pageInfo.endCursor;
    if (!endCursor) return;
    await fetchMore({ variables: { tenantId: instituteId, first: 20, after: endCursor } });
  };

  return (
    <Card data-testid={testIds.adminInstituteDetail.auditTab}>
      <CardHeader>
        <CardTitle>{tTab('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <EntityTimelineBase
          entityType="Institute"
          entityId={instituteId}
          t={t}
          formatDate={(d, f) => format(d, f)}
          data={timelineData}
          loading={loading}
          hasNextPage={data?.adminAuditLogs.pageInfo.hasNextPage ?? false}
          onLoadMore={handleLoadMore}
          canRead
          emptyStateTestId="institute-audit-empty"
        />
      </CardContent>
    </Card>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
