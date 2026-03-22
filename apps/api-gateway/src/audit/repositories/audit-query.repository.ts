import type { AuditLogQueryResult, FindAuditLogsParams } from './types';

export abstract class AuditQueryRepository {
  abstract findAuditLogs(params: FindAuditLogsParams): Promise<AuditLogQueryResult>;
  abstract findAuthEvents(tenantId: string | undefined, first: number): Promise<AuthEventRow[]>;
}

export interface AuthEventRow {
  id: string;
  userId: string | null;
  eventType: string;
  scope: string | null;
  tenantId: string | null;
  resellerId: string | null;
  authMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
