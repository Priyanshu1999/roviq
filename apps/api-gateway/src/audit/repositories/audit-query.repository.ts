import type { AuditLogQueryResult, FindAuditLogsParams } from './types';

export abstract class AuditQueryRepository {
  abstract findAuditLogs(params: FindAuditLogsParams): Promise<AuditLogQueryResult>;
}
