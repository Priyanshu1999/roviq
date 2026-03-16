import type { I18nContent } from '@roviq/database';

export interface AuditLogRow {
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
  createdAt: Date;
  actorName: string | null;
  userName: string | null;
  tenantName: I18nContent | null;
}

export interface AuditEventData {
  tenantId: string;
  userId: string;
  actorId: string;
  impersonatorId?: string;
  action: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  source: string;
}

export interface FindAuditLogsParams {
  tenantId: string;
  filter?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    actionTypes?: string[];
    correlationId?: string;
    dateRange?: { from: Date; to: Date };
  };
  first: number;
  after?: string;
}

export interface AuditLogEdge {
  cursor: string;
  node: AuditLogRow;
}

export interface AuditLogQueryResult {
  edges: AuditLogEdge[];
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    endCursor: string | null;
    startCursor: string | null;
  };
}
