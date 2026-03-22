import { Injectable } from '@nestjs/common';
import type { AuditLogConnection } from './models/audit-log-connection.model';
import type { AuthEventModel } from './models/auth-event.model';
import { AuditQueryRepository } from './repositories/audit-query.repository';
import type { FindAuditLogsParams } from './repositories/types';

@Injectable()
export class AuditService {
  constructor(private readonly auditQueryRepo: AuditQueryRepository) {}

  async findAuditLogs(params: FindAuditLogsParams): Promise<AuditLogConnection> {
    return this.auditQueryRepo.findAuditLogs(params) as unknown as AuditLogConnection;
  }

  async findAuthEvents(tenantId: string | undefined, first: number): Promise<AuthEventModel[]> {
    return this.auditQueryRepo.findAuthEvents(tenantId, first) as unknown as AuthEventModel[];
  }
}
