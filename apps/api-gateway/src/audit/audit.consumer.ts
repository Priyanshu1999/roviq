import { AckPolicy, type ConsumerMessages, jetstream, jetstreamManager } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { publishToDlq } from '@roviq/nats-utils';
import type pg from 'pg';
import { AUDIT_DB_POOL } from './audit-db.provider';
import { NATS_CONNECTION } from './nats.provider';

interface AuditEventPayload {
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
  ipAddress?: string;
  userAgent?: string;
  source: string;
}

interface BufferedMessage {
  event: AuditEventPayload;
  correlationId: string;
  tenantId: string;
  ack: () => void;
  nak: (delay?: number) => void;
  term: () => void;
  subject: string;
  deliveryCount: number;
}

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 500;
const MAX_RETRIES = 3;
const CONSUMER_NAME = 'audit-log-writer';

@Injectable()
export class AuditConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumer.name);
  private buffer: BufferedMessage[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private consumerMessages: ConsumerMessages | null = null;

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    @Inject(AUDIT_DB_POOL) private readonly pool: pg.Pool,
  ) {}

  async onModuleInit(): Promise<void> {
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

        let event: AuditEventPayload;
        try {
          event = msg.json<AuditEventPayload>();
        } catch {
          await publishToDlq(
            this.nc,
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
      await this.batchInsert(batch);
      for (const msg of batch) msg.ack();
    } catch (err) {
      for (const msg of batch) {
        if (msg.deliveryCount >= MAX_RETRIES) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await publishToDlq(
            this.nc,
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

  private async batchInsert(batch: BufferedMessage[]): Promise<void> {
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

    for (let i = 0; i < batch.length; i++) {
      const offset = i * valuesPerRow;
      const row = [];
      for (let j = 1; j <= valuesPerRow; j++) {
        row.push(`$${offset + j}`);
      }
      placeholders.push(`(${row.join(', ')})`);

      const e = batch[i].event;
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
        batch[i].correlationId,
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
