import {
  AckPolicy,
  type ConsumerMessages,
  type JetStreamClient,
  jetstream,
  jetstreamManager,
} from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { publishToDlq } from '@roviq/nats-jetstream';
import type pg from 'pg';
import { AUDIT_DB_POOL } from './audit-db.provider';
import { NATS_CONNECTION } from './nats.provider';

/**
 * Must match the audit_logs table schema from ROV-64 exactly (19 columns).
 * Includes scope + resellerId + impersonationSessionId from three-scope auth.
 */
export interface AuditEvent {
  /** Auto-generated UUID by AuditEmitter */
  id: string;
  /** 'platform' | 'reseller' | 'institute' */
  scope: string;
  /** NULL for platform/reseller-scoped events */
  tenantId: string | null;
  /** Set only for reseller-scoped actions */
  resellerId: string | null;
  /** The user whose data was affected */
  userId: string;
  /** Real person (same as userId unless impersonating) */
  actorId: string;
  /** Set only during impersonation */
  impersonatorId: string | null;
  /** FK to impersonation_sessions */
  impersonationSessionId: string | null;
  /** GraphQL mutation name or service action */
  action: string;
  /** CREATE | UPDATE | DELETE | RESTORE | ASSIGN | REVOKE | SUSPEND | ACTIVATE */
  actionType: string;
  /** Affected entity model (e.g., 'Student', 'Section') */
  entityType: string;
  /** Affected entity ID (null for bulk operations) */
  entityId: string | null;
  /** Diff: { field: { old: x, new: y } } */
  changes: Record<string, unknown> | null;
  /** Additional context: input args, affected_count, entity_ids */
  metadata: Record<string, unknown> | null;
  /** Request correlation ID for tracing */
  correlationId: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Where event originated: 'GATEWAY', 'CORE_SERVICE', etc. */
  source: string;
  /** ISO timestamp from AuditEmitter */
  createdAt: string;
}

interface BufferedMessage {
  event: AuditEvent;
  correlationId: string;
  tenantId: string;
  ack: () => void;
  nak: (delay?: number) => void;
  term: () => void;
  subject: string;
  deliveryCount: number;
}

/** Flush at 50 events or 500ms, whichever comes first */
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 500;
/** After 3 failed deliveries, send to DLQ */
const MAX_RETRIES = 3;
const CONSUMER_NAME = 'audit-log-writer';

/**
 * NATS JetStream pull consumer that receives audit.log events and
 * persists them to audit_logs via batched raw SQL inserts.
 *
 * - Deferred ack: messages acked only after successful batch write
 * - Idempotent: ON CONFLICT (id, created_at) DO NOTHING handles redelivery
 * - DLQ: malformed JSON → term immediately; failed writes after MAX_RETRIES → DLQ
 * - Raw pg Pool: bypasses Drizzle/RLS for cross-tenant batch writes
 */
@Injectable()
export class AuditConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumer.name);
  private buffer: BufferedMessage[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private consumerMessages: ConsumerMessages | null = null;
  private jsClient!: JetStreamClient;

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    @Inject(AUDIT_DB_POOL) private readonly pool: pg.Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    this.jsClient = jetstream(this.nc);
    await this.ensureConsumer();
    this.startFlushTimer();
    void this.startConsuming();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumerMessages?.close();
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
    await this.pool.end();
  }

  private async ensureConsumer(): Promise<void> {
    const jsm = await jetstreamManager(this.nc);
    try {
      await jsm.consumers.info('AUDIT', CONSUMER_NAME);
      return;
    } catch {
      this.logger.log(`Consumer ${CONSUMER_NAME} not found, creating...`);
    }
    await jsm.consumers.add('AUDIT', {
      durable_name: CONSUMER_NAME,
      filter_subject: 'AUDIT.log',
      ack_policy: AckPolicy.Explicit,
      max_deliver: MAX_RETRIES + 1,
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        void this.flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  private async startConsuming(): Promise<void> {
    const js = jetstream(this.nc);
    const consumer = await js.consumers.get('AUDIT', CONSUMER_NAME);

    try {
      const messages = await consumer.consume();
      this.consumerMessages = messages;

      for await (const msg of messages) {
        const correlationId = msg.headers?.get('correlation-id') ?? 'unknown';
        const tenantId = msg.headers?.get('tenant-id') ?? '';
        const deliveryCount = msg.info.deliveryCount;

        let event: AuditEvent;
        try {
          const raw = msg.json<Record<string, unknown>>();
          // JetStreamClient wraps data in NestJS packet format { pattern, data }
          event = (raw.data && typeof raw.data === 'object' ? raw.data : raw) as AuditEvent;
        } catch {
          // Malformed JSON — send directly to DLQ, no retry
          await publishToDlq(
            this.jsClient,
            msg.subject,
            null,
            'Malformed JSON payload',
            deliveryCount,
            correlationId,
            tenantId,
          );
          msg.term();
          continue;
        }

        this.buffer.push({
          event,
          correlationId,
          tenantId,
          ack: () => msg.ack(),
          nak: (delay) => msg.nak(delay),
          term: () => msg.term(),
          subject: msg.subject,
          deliveryCount,
        });

        if (this.buffer.length >= BATCH_SIZE) {
          await this.flush();
        }
      }
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('closed'))) {
        this.logger.error('Audit consumer error', err);
      }
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      await this.batchInsert(batch.map((b) => b.event));
      for (const msg of batch) msg.ack();
    } catch (err) {
      // Batch failed — handle each message individually
      for (const msg of batch) {
        if (msg.deliveryCount >= MAX_RETRIES) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await publishToDlq(
            this.jsClient,
            msg.subject,
            msg.event,
            errorMessage,
            msg.deliveryCount,
            msg.correlationId,
            msg.tenantId,
          );
          msg.term();
        } else {
          msg.nak();
        }
      }
    }
  }

  /**
   * Batched parameterized INSERT into audit_logs.
   * Uses $N placeholders — no string interpolation, SQL injection safe.
   * ON CONFLICT (id, created_at) DO NOTHING for idempotent dedup on redelivery.
   */
  private async batchInsert(events: AuditEvent[]): Promise<void> {
    // Column order matches audit_logs DDL from ROV-64 exactly
    const columns = [
      'id',
      'scope',
      'tenant_id',
      'reseller_id',
      'user_id',
      'actor_id',
      'impersonator_id',
      'impersonation_session_id',
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
      'created_at',
    ];
    const colCount = columns.length;
    const placeholders: string[] = [];
    const values: unknown[] = [];

    for (let i = 0; i < events.length; i++) {
      const offset = i * colCount;
      const row: string[] = [];
      for (let j = 1; j <= colCount; j++) {
        row.push(`$${offset + j}`);
      }
      placeholders.push(`(${row.join(', ')})`);

      const e = events[i];
      values.push(
        e.id,
        e.scope,
        e.tenantId,
        e.resellerId,
        e.userId,
        e.actorId,
        e.impersonatorId,
        e.impersonationSessionId,
        e.action,
        e.actionType,
        e.entityType,
        e.entityId,
        e.changes ? JSON.stringify(e.changes) : null,
        e.metadata ? JSON.stringify(e.metadata) : null,
        e.correlationId,
        e.ipAddress,
        e.userAgent,
        e.source,
        e.createdAt,
      );
    }

    const query = `
      INSERT INTO audit_logs (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id, created_at) DO NOTHING
    `;
    await this.pool.query(query, values);
  }
}
