import { Inject, Injectable } from '@nestjs/common';
import { auditLogs, DRIZZLE_DB, type DrizzleDB } from '@roviq/database';
import { AuditWriteRepository } from './audit-write.repository';
import type { AuditEventData } from './types';

@Injectable()
export class AuditWriteDrizzleRepository extends AuditWriteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async batchInsert(events: AuditEventData[]): Promise<void> {
    if (events.length === 0) return;

    await this.db.insert(auditLogs).values(
      events.map((e) => ({
        scope: e.scope,
        tenantId: e.tenantId,
        resellerId: e.resellerId ?? null,
        userId: e.userId,
        actorId: e.actorId,
        impersonatorId: e.impersonatorId ?? null,
        impersonationSessionId: e.impersonationSessionId ?? null,
        action: e.action,
        actionType: e.actionType,
        entityType: e.entityType,
        entityId: e.entityId ?? null,
        changes: e.changes ?? null,
        metadata: e.metadata ?? null,
        correlationId: e.correlationId,
        ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null,
        source: e.source,
      })),
    );
  }
}
