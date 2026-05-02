import type { I18nContent } from '@roviq/database';

export interface AuditLogRow {
  id: string;
  /** 'platform' | 'reseller' | 'institute' — determines RLS visibility */
  scope: string;
  tenantId: string | null;
  /** Set only for reseller-scoped actions */
  resellerId: string | null;
  userId: string;
  actorId: string;
  impersonatorId: string | null;
  /** FK to impersonation_sessions */
  impersonationSessionId: string | null;
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
  syntheticOrigin: string | null;
  createdAt: Date;
  actorName: string | null;
  userName: string | null;
  tenantName: I18nContent | null;
}

export interface AuditEventData {
  /** 'platform' | 'reseller' | 'institute' */
  scope: string;
  tenantId: string | null;
  /** Set only for reseller-scoped actions */
  resellerId?: string;
  userId: string;
  actorId: string;
  impersonatorId?: string;
  /** FK to impersonation_sessions */
  impersonationSessionId?: string;
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
  /** Institute scope: set tenantId for RLS via withTenant */
  tenantId?: string;
  /** Reseller scope: set resellerId for RLS via withReseller */
  resellerId?: string;
  filter?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    actionTypes?: string[];
    correlationId?: string;
    dateRange?: { from: Date; to: Date };
    syntheticOrigin?: string;
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
