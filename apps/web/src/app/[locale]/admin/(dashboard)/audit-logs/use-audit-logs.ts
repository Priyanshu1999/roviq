'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { AuditLogsQuery, AuditLogsQueryVariables } from './use-audit-logs.generated';

export type AuditLogNode = AuditLogsQuery['adminAuditLogs']['edges'][number]['node'];

const ADMIN_AUDIT_LOGS_QUERY = gql`
  query AdminAuditLogs($filter: AuditLogFilterInput, $first: Int, $after: String) {
    adminAuditLogs(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          tenantId
          userId
          actorId
          impersonatorId
          action
          actionType
          entityType
          entityId
          changes
          metadata
          correlationId
          ipAddress
          userAgent
          source
          createdAt
          actorName
          userName
          tenantName
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
        startCursor
      }
    }
  }
`;

export function useAuditLogs(variables: AuditLogsQueryVariables) {
  const { data, loading, error, fetchMore } = useQuery<AuditLogsQuery, AuditLogsQueryVariables>(
    ADMIN_AUDIT_LOGS_QUERY,
    {
      variables,
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.adminAuditLogs.pageInfo.endCursor;
    if (!endCursor) return;

    return fetchMore({
      variables: { ...variables, after: endCursor },
    });
  };

  return {
    logs: data?.adminAuditLogs.edges.map((edge) => edge.node) ?? [],
    totalCount: data?.adminAuditLogs.totalCount ?? 0,
    hasNextPage: data?.adminAuditLogs.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
  };
}
