import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type pg from 'pg';
import { AUDIT_DB_POOL } from '../audit-db.provider';
import { AuditWriteRepository } from './audit-write.repository';
import type { AuditEventData } from './types';

@Injectable()
export class AuditWritePgRepository extends AuditWriteRepository implements OnModuleDestroy {
  constructor(@Inject(AUDIT_DB_POOL) private readonly pool: pg.Pool) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async batchInsert(events: AuditEventData[]): Promise<void> {
    const columns = [
      'tenant_id',
      'user_id',
      'actor_id',
      'impersonator_id',
      'action',
      'action_type',
      'entity_type',
      'entity_id',
      'changes',
      'metadata',
      'correlation_id',
      'ip_address',
      'user_agent',
      'source',
    ];
    const valuesPerRow = columns.length;
    const placeholders: string[] = [];
    const values: unknown[] = [];

    for (let i = 0; i < events.length; i++) {
      const offset = i * valuesPerRow;
      const row = [];
      for (let j = 1; j <= valuesPerRow; j++) {
        row.push(`$${offset + j}`);
      }
      placeholders.push(`(${row.join(', ')})`);

      const e = events[i];
      values.push(
        e.tenantId,
        e.userId,
        e.actorId,
        e.impersonatorId ?? null,
        e.action,
        e.actionType,
        e.entityType,
        e.entityId ?? null,
        e.changes ? JSON.stringify(e.changes) : null,
        e.metadata ? JSON.stringify(e.metadata) : null,
        e.correlationId,
        e.ipAddress ?? null,
        e.userAgent ?? null,
        e.source,
      );
    }

    const query = `
      INSERT INTO audit_logs (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
    `;
    await this.pool.query(query, values);
  }
}
