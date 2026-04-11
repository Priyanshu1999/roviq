'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { AuditLog, AuditLogFilterInput } from '@roviq/graphql/generated';

export type AuditLogNode = AuditLog;

interface AuditLogsQueryResult {
  auditLogs: {
    edges: { cursor: string; node: AuditLogNode }[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      endCursor: string | null;
      startCursor: string | null;
    };
  };
}

export interface UseAuditLogsVariables {
  filter?: AuditLogFilterInput;
  first?: number;
  after?: string;
}

const AUDIT_LOGS_QUERY = gql`
  query InstituteAuditLogs($filter: AuditLogFilterInput, $first: Int, $after: String) {
    auditLogs(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
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

export function useAuditLogs(variables: UseAuditLogsVariables) {
  const { data, loading, error, fetchMore } = useQuery<AuditLogsQueryResult, UseAuditLogsVariables>(
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
