import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { EVENT_PATTERNS } from '@roviq/nats-jetstream';
import { firstValueFrom } from 'rxjs';

/**
 * Scope-aware audit event payload matching the audit_logs column schema exactly.
 * Scope determines which FK columns must be set (enforced by DB CHECK constraint).
 */
export interface AuditEventPayload {
  /** 'platform' | 'reseller' | 'institute' — determines RLS visibility and required FKs */
  scope: 'platform' | 'reseller' | 'institute';
  /** NULL for platform/reseller scope; NOT NULL for institute scope */
  tenantId: string | null;
  /** Set only for reseller-scoped actions; NULL otherwise */
  resellerId: string | null;

  /** Identity being acted as (the affected user) */
  userId: string;
  /** Real person who performed the action (same as userId unless impersonating) */
  actorId: string;
  /** Set only during impersonation — the admin/reseller acting on behalf of userId */
  impersonatorId: string | null;
  /** FK to impersonation_sessions for full impersonation audit trail */
  impersonationSessionId: string | null;

  /** Domain action name, e.g. 'createAttendanceRecords', 'revokeImpersonationSession' */
  action: string;
  /** Action category */
  actionType:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'RESTORE'
    | 'ASSIGN'
    | 'REVOKE'
    | 'SUSPEND'
    | 'ACTIVATE';
  /** Entity type affected, e.g. 'AttendanceRecord', 'ImpersonationSession' */
  entityType: string;
  /** ID of the affected entity; NULL for bulk operations */
  entityId: string | null;

  /** { field: { old, new } } for UPDATE; full snapshot for DELETE; NULL for bulk ops */
  changes: Record<string, { old: unknown; new: unknown }> | null;
  /** { affected_count, entity_ids[], input, error } — additional action context */
  metadata: Record<string, unknown> | null;

  /** MUST be the same as the originating request's correlation ID */
  correlationId: string;
  /** Source system identifier */
  source: string;
  /**
   * Set when actorId is the synthetic-user UUID (00000000-…) — identifies
   * the originating workflow / consumer / seeder so audit rows produced by
   * `mk*Ctx` factories are attributable. Null for normal JWT requests.
   * Examples: 'workflow:tc-issuance', 'consumer:billing-event', 'seeder'.
   */
  syntheticOrigin?: string | null;
}

/**
 * Shared utility for emitting scope-aware audit events via JetStream.
 *
 * Used by services for Layer 2 capture — internally-triggered side effects
 * that the gateway interceptor doesn't see (e.g., enrollment creating
 * attendance records, reseller suspension revoking sessions).
 *
 * Non-blocking — publishes to NATS JetStream and returns after ack.
 * The AuditConsumer picks it up and writes to PostgreSQL.
 *
 * Headers (correlation-id, tenant-id, actor-id, impersonator-id) are
 * auto-injected by JetStreamClient from AsyncLocalStorage — no explicit
 * header management needed.
 */
@Injectable()
export class AuditEmitter {
  private readonly logger = new Logger(AuditEmitter.name);

  constructor(@Inject('JETSTREAM_CLIENT') private readonly client: ClientProxy) {}

  /**
   * Emit an audit event for a service-level side effect.
   * Publishes to 'AUDIT.log' JetStream subject.
   */
  async emit(payload: AuditEventPayload): Promise<void> {
    const event = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: new Date().toISOString(),
    };

    await firstValueFrom(this.client.emit(EVENT_PATTERNS.AUDIT.log, event));
    this.logger.debug(`Audit event emitted: ${payload.action} [${payload.entityType}]`);
  }

  /**
   * Convenience: emit for a bulk operation.
   * Sets entityId to null, puts entity_ids and affected_count in metadata.
   */
  async emitBulk(
    payload: Omit<AuditEventPayload, 'entityId'> & {
      entityIds: string[];
      affectedCount: number;
    },
  ): Promise<void> {
    const { entityIds, affectedCount, ...rest } = payload;

    await this.emit({
      ...rest,
      entityId: null,
      metadata: {
        ...rest.metadata,
        entity_ids: entityIds,
        affected_count: affectedCount,
      },
    });
  }
}
