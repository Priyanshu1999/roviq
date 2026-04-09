import type { JetStreamClient as NatsJetStreamClient, PubAck } from '@nats-io/jetstream';
import { jetstream } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { headers as natsHeaders } from '@nats-io/nats-core';
import { connect } from '@nats-io/transport-node';
import { Logger } from '@nestjs/common';
import type { ReadPacket } from '@nestjs/microservices';
import { ClientNats } from '@nestjs/microservices';
import { requestContext } from '@roviq/request-context';
import { Observable, ReplaySubject } from 'rxjs';

/**
 * NestJS custom transport client that publishes events via JetStream
 * instead of core NATS, providing durable at-least-once delivery.
 *
 * Extends ClientNats to reuse connection lifecycle, serialization,
 * and request/response (send). Overrides emit/dispatchEvent for JetStream.
 *
 * @see docs/superpowers/specs/2026-03-17-nats-jetstream-transport-design.md
 */
export class JetStreamClient extends ClientNats {
  protected override readonly logger = new Logger(JetStreamClient.name);

  private jsClient!: NatsJetStreamClient;

  /**
   * Override to use @nats-io/transport-node (v3) instead of the
   * `nats` (v2) package that ClientNats uses via require('nats').
   * This is required because @nats-io/jetstream v3 expects a v3 NatsConnection.
   */
  override createClient(): Promise<NatsConnection> {
    const options = (this as unknown as { options: Record<string, unknown> }).options || {};
    return connect({
      servers: 'nats://localhost:4222',
      ...options,
    });
  }

  /**
   * Connect to NATS, then store a JetStream client reference.
   */
  // biome-ignore lint/suspicious/noExplicitAny: matching ClientNats.connect() return type
  override async connect(): Promise<any> {
    const client = await super.connect();
    this.jsClient = jetstream(client);
    return client;
  }

  /**
   * Override to publish events via JetStream instead of core NATS.
   *
   * Serializes the packet using the inherited serializer pipeline,
   * merges headers (including auto-injected request context), and
   * publishes to JetStream for durable stream persistence.
   */
  protected override async dispatchEvent(packet: ReadPacket): Promise<PubAck> {
    const pattern = this.normalizePattern(packet.pattern);
    const serializedPacket = this.serializer.serialize(packet);
    const headers = this.mergeHeaders(serializedPacket.headers);

    return this.jsClient.publish(pattern, serializedPacket.data, {
      headers,
    });
  }

  /**
   * Override to return a HOT Observable via ReplaySubject.
   *
   * The base ClientProxy.emit() uses connectable with a plain Subject,
   * meaning late subscribers miss the value. Using ReplaySubject(1) ensures
   * the PubAck (or error) is captured and replayed to late subscribers.
   *
   * This also means `void client.emit(...)` fires reliably — errors
   * are logged but do not crash the process.
   */
  // biome-ignore lint/suspicious/noExplicitAny: matching ClientProxy.emit() signature
  override emit<TResult = PubAck, TInput = any>(pattern: any, data: TInput): Observable<TResult> {
    const cold$ = super.emit<TResult, TInput>(pattern, data);

    const subject = new ReplaySubject<TResult>(1);
    cold$.subscribe({
      next: (v) => subject.next(v),
      error: (err) => {
        this.logger.error(
          `JetStream publish failed [${JSON.stringify(pattern)}]`,
          err instanceof Error ? err.message : String(err),
        );
        subject.error(err);
      },
      complete: () => subject.complete(),
    });

    return subject.asObservable();
  }

  /**
   * Merge headers from the serializer with auto-injected request context.
   *
   * When running inside a request (AsyncLocalStorage has a store),
   * automatically propagates correlation-id, tenant-id, actor-id,
   * and impersonator-id to outgoing messages.
   *
   * Out-of-context callers (cron, Temporal, onModuleInit) get a warning
   * and should pass headers explicitly via NatsRecordBuilder.
   */
  // biome-ignore lint/suspicious/noExplicitAny: matching ClientNats.mergeHeaders() signature
  protected override mergeHeaders(requestHeaders?: any): any {
    const hdrs = super.mergeHeaders(requestHeaders) ?? natsHeaders();
    const ctx = requestContext.getStore();

    if (ctx) {
      if (!hdrs.has('correlation-id')) {
        hdrs.set('correlation-id', ctx.correlationId);
      }
      if (!hdrs.has('tenant-id')) {
        hdrs.set('tenant-id', ctx.tenantId ?? '');
      }
      if (!hdrs.has('actor-id')) {
        hdrs.set('actor-id', ctx.userId ?? '');
      }
      if (!hdrs.has('impersonator-id')) {
        hdrs.set('impersonator-id', ctx.impersonatorId ?? '');
      }
    } else {
      this.logger.warn(
        'JetStreamClient: No request context (cron/Temporal/onModuleInit?). ' +
          'Pass headers explicitly via NatsRecordBuilder.',
      );
      if (!hdrs.has('correlation-id')) {
        hdrs.set('correlation-id', crypto.randomUUID());
      }
    }

    return hdrs;
  }
}
