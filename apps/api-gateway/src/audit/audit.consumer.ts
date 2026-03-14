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
import { NATS_CONNECTION } from './nats.provider';
import { AuditWriteRepository } from './repositories/audit-write.repository';
import type { AuditEventData } from './repositories/types';

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
    private readonly auditWriteRepo: AuditWriteRepository,
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
      const events: AuditEventData[] = batch.map((msg) => ({
        ...msg.event,
        correlationId: msg.correlationId,
      }));
      await this.auditWriteRepo.batchInsert(events);
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
}
