'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { AuditLogsQuery, AuditLogsQueryVariables } from './use-audit-logs.generated';

export type AuditLogNode = AuditLogsQuery['auditLogs']['edges'][number]['node'];

const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($filter: AuditLogFilterInput, $first: Int, $after: String) {
    auditLogs(filter: $filter, first: $first, after: $after) {
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
    AUDIT_LOGS_QUERY,
    {
      variables,
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.auditLogs.pageInfo.endCursor;
    if (!endCursor) return;

    return fetchMore({
      variables: { ...variables, after: endCursor },
    });
  };

  return {
    logs: data?.auditLogs.edges.map((edge) => edge.node) ?? [],
    totalCount: data?.auditLogs.totalCount ?? 0,
    hasNextPage: data?.auditLogs.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
  };
}
