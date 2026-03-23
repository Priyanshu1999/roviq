import { Injectable } from '@nestjs/common';
import { AuditQueryRepository, type AuthEventRow } from './repositories/audit-query.repository';
import type { AuditLogQueryResult, FindAuditLogsParams } from './repositories/types';

@Injectable()
export class AuditService {
  constructor(private readonly auditQueryRepo: AuditQueryRepository) {}

  async findAuditLogs(params: FindAuditLogsParams): Promise<AuditLogQueryResult> {
    return this.auditQueryRepo.findAuditLogs(params);
  }

  async findAuthEvents(tenantId: string | undefined, first: number): Promise<AuthEventRow[]> {
    return this.auditQueryRepo.findAuthEvents(tenantId, first);
  }
}
