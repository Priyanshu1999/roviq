'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { AuditLog, AuditLogFilterInput } from '@roviq/graphql/generated';

export type ResellerAuditLogNode = AuditLog;

interface ResellerAuditLogsQueryResult {
  resellerAuditLogs: {
    edges: { cursor: string; node: ResellerAuditLogNode }[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface UseResellerAuditLogsVariables {
  filter?: AuditLogFilterInput;
  first?: number;
  after?: string;
}

const RESELLER_AUDIT_LOGS_QUERY = gql`
  query ResellerAuditLogs($filter: AuditLogFilterInput, $first: Int, $after: String) {
    resellerAuditLogs(filter: $filter, first: $first, after: $after) {
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
        endCursor
      }
    }
  }
`;

export function useResellerAuditLogs(variables: UseResellerAuditLogsVariables) {
  const { data, loading, error, fetchMore } = useQuery<
    ResellerAuditLogsQueryResult,
    UseResellerAuditLogsVariables
  >(RESELLER_AUDIT_LOGS_QUERY, {
    variables,
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = () => {
    const endCursor = data?.resellerAuditLogs.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({ variables: { ...variables, after: endCursor } });
  };

  return {
    logs: data?.resellerAuditLogs.edges.map((edge) => edge.node) ?? [],
    totalCount: data?.resellerAuditLogs.totalCount ?? 0,
    hasNextPage: data?.resellerAuditLogs.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
  };
}
