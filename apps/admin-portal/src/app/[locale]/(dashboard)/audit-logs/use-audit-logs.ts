'use client';

import { gql, useQuery } from '@roviq/graphql';

export interface AuditLogNode {
  id: string;
  tenantId: string;
  userId: string;
  actorId: string;
  impersonatorId: string | null;
  action: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  correlationId: string;
  ipAddress: string | null;
  userAgent: string | null;
  source: string;
  createdAt: string;
  actorName: string | null;
  userName: string | null;
  tenantName: string | null;
}

interface AuditLogEdge {
  cursor: string;
  node: AuditLogNode;
}

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  endCursor: string | null;
  startCursor: string | null;
}

interface AuditLogsData {
  auditLogs: {
    edges: AuditLogEdge[];
    totalCount: number;
    pageInfo: PageInfo;
  };
}

interface AuditLogsVariables {
  filter?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    actionTypes?: string[];
    correlationId?: string;
    dateRange?: { from: string; to: string };
  };
  first?: number;
  after?: string;
}

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

export function useAuditLogs(variables: AuditLogsVariables) {
  const { data, loading, error, fetchMore } = useQuery<AuditLogsData, AuditLogsVariables>(
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
