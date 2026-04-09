import type {
  ConsumerMessages,
  JsMsg,
  JetStreamClient as NatsJetStreamClient,
} from '@nats-io/jetstream';
import { AckPolicy, JetStreamApiError, jetstream, jetstreamManager } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { connect } from '@nats-io/transport-node';
import { Logger } from '@nestjs/common';
import { ServerNats } from '@nestjs/microservices';
import { AuthScope } from '@roviq/common-types';
import { type RequestContext, requestContext } from '@roviq/request-context';
import { JetStreamContext, type JetStreamMeta } from '../context/jetstream.context';
import { publishToDlq } from '../dlq/dlq.handler';
import type {
  ConsumerExtras,
  JetStreamServerOptions,
  ResolvedConsumerConfig,
} from '../interfaces/jetstream.options';
import { DEFAULT_DLQ_STREAM } from '../streams/stream.config';
import { ensureStreams } from '../streams/stream.manager';
import { DeserializationError, HandlerTimeoutError } from './errors';
import { Semaphore } from './semaphore';

/**
 * NestJS microservice event packet: client serializers wrap the outgoing
 * value as `{ pattern, data }`. See @nestjs/microservices NatsRecordSerializer
 * (line 18): `jsonCodec.encode({ ...packet, data: natsMessage.data })`.
 *
 * The server MUST extract `.data` before passing to handlers — this is
 * what NestJS's own `ServerNats.handleMessage` → `handleEvent` does.
 */
interface IncomingPacket {
  pattern: string;
  data: unknown;
}

/** Handler function type matching NestJS microservice handler signature */
type MessageHandler = (data: unknown, ctx: JetStreamContext) => Promise<unknown>;

/**
 * NestJS custom transport server that uses JetStream pull consumers
 * for durable, at-least-once message delivery.
 *
 * Extends ServerNats to reuse NATS connection lifecycle, serialization,
 * and message routing. Overrides listen(), bindEvents(), and close()
 * to use JetStream consumers instead of core NATS subscriptions.
 *
 * @see docs/superpowers/specs/2026-03-17-nats-jetstream-transport-design.md
 */
export class JetStreamServer extends ServerNats {
  protected override readonly logger = new Logger(JetStreamServer.name);

  private readonly consumers = new Map<string, ConsumerMessages>();
  private js!: NatsJetStreamClient;
  private nc!: NatsConnection;

  private readonly jsOptions: JetStreamServerOptions;

  constructor(options: JetStreamServerOptions) {
    // ServerNats expects NatsOptions['options'] which has [key: string]: any
    // so our extra fields pass through safely
    super(options as Parameters<typeof ServerNats.prototype.listen>[0] & JetStreamServerOptions);
    this.jsOptions = options;
  }

  /**
   * Override to use @nats-io/transport-node (v3) instead of the
   * `nats` (v2) package that ServerNats uses via require('nats').
   * This is required because @nats-io/jetstream v3 expects a v3 NatsConnection.
   */
  override createNatsClient(): Promise<NatsConnection> {
    return connect({
      servers: this.jsOptions.servers,
    });
  }

  override async listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ): Promise<void> {
    try {
      // 1. Create the NATS connection (inherited from ServerNats)
      this.nc = await this.createNatsClient();
      // Store on the inherited private field so close() can drain it
      Object.assign(this, { natsClient: this.nc });

      // 2. Ensure all configured streams exist
      await ensureStreams(this.nc, this.jsOptions.streams);

      // 3. Auto-create DLQ stream if enabled and not already in streams config
      await this.ensureDlqStream();

      // 4. Ensure durable consumers for each @EventPattern handler
      await this.ensureConsumers();

      // 5. Store JetStream client reference
      this.js = jetstream(this.nc);

      // 6. Start pull consumers
      this.bindEvents(this.nc);

      // 7. Handle status updates (inherited)
      void this.handleStatusUpdates(this.nc);

      callback();
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Ensure DLQ stream exists if DLQ is enabled.
   */
  private async ensureDlqStream(): Promise<void> {
    const dlqEnabled = this.jsOptions.dlq?.enabled !== false;
    if (!dlqEnabled) return;

    const dlqStreamName = this.jsOptions.dlq?.stream ?? 'DLQ';
    const dlqAlreadyConfigured = this.jsOptions.streams.some((s) => s.name === dlqStreamName);
    if (!dlqAlreadyConfigured) {
      await ensureStreams(this.nc, [DEFAULT_DLQ_STREAM]);
    }
  }

  /**
   * Create durable consumers for each registered @EventPattern handler
   * via JetStream Manager.
   */
  private async ensureConsumers(): Promise<void> {
    const jsm = await jetstreamManager(this.nc);

    for (const [pattern, handler] of this.messageHandlers) {
      const config = this.resolveConsumerConfig(
        pattern,
        handler.extras as ConsumerExtras | undefined,
      );

      try {
        await jsm.consumers.add(config.stream, {
          durable_name: config.durable,
          ack_policy: AckPolicy.Explicit,
          filter_subject: pattern,
          max_deliver: config.maxDeliver,
        });
        this.logger.log(
          `Consumer "${config.durable}" ensured on stream "${config.stream}" for "${pattern}"`,
        );
      } catch (err) {
        // Consumer already exists with compatible config — safe to ignore
        if (err instanceof JetStreamApiError && err.code === 10148) {
          this.logger.log(
            `Consumer "${config.durable}" already exists on stream "${config.stream}"`,
          );
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Override ServerNats.bindEvents() to start JetStream pull consumers
   * instead of core NATS subscriptions.
   */
  override bindEvents(_client: NatsConnection): void {
    for (const [pattern, handler] of this.messageHandlers) {
      const config = this.resolveConsumerConfig(
        pattern,
        handler.extras as ConsumerExtras | undefined,
      );

      // Start the consumer asynchronously — non-blocking
      void this.startConsumer(pattern, handler as MessageHandler, config);
    }
  }

  /**
   * Start a pull consumer for a single pattern and begin consuming.
   */
  private async startConsumer(
    pattern: string,
    handler: MessageHandler,
    config: ResolvedConsumerConfig,
  ): Promise<void> {
    try {
      const consumer = await this.js.consumers.get(config.stream, config.durable);

      const messages = await consumer.consume({
        max_messages: config.pull.batchSize,
        idle_heartbeat: config.pull.idleHeartbeat,
        expires: config.pull.expires,
      });

      this.consumers.set(config.durable, messages);
      void this.consumeLoop(pattern, messages, handler, config);
    } catch (err) {
      this.logger.error(
        `Failed to start consumer "${config.durable}" on stream "${config.stream}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Consume loop with semaphore-based concurrency control.
   * Processes messages from the pull consumer's async iterator.
   */
  private async consumeLoop(
    pattern: string,
    messages: ConsumerMessages,
    handler: MessageHandler,
    config: ResolvedConsumerConfig,
  ): Promise<void> {
    const semaphore = new Semaphore(config.concurrency);

    for await (const msg of messages) {
      await semaphore.acquire();
      void this.processMessage(pattern, msg, handler, config).finally(() => semaphore.release());
    }
  }

  /**
   * Full message lifecycle: deserialize, restore context, execute handler
   * with timeout, and manage ack/nak/dlq.
   */
  private async processMessage(
    pattern: string,
    msg: JsMsg,
    handler: MessageHandler,
    config: ResolvedConsumerConfig,
  ): Promise<void> {
    const deliveryCount = msg.info.deliveryCount;
    const correlationId = msg.headers?.get('correlation-id') || crypto.randomUUID();
    const tenantId = msg.headers?.get('tenant-id') || undefined;

    // 1. Deserialize the raw JetStream message envelope produced by
    //    JetStreamClient. The client uses NestJS's NatsRecordSerializer
    //    which publishes a JSON-encoded `{ pattern, data }` packet. The
    //    handler expects the unwrapped `data` (matching @Payload()
    //    semantics in the base ServerNats.handleMessage).
    let envelope: IncomingPacket;
    try {
      envelope = msg.json<IncomingPacket>();
    } catch (err) {
      await this.handleDeserializationError(msg, err, deliveryCount, correlationId, tenantId);
      return;
    }

    const payload = envelope?.data ?? envelope;

    // 2. Build context and execute handler with the unwrapped data
    const abort = new AbortController();
    const ctx = this.buildContext(msg, config, deliveryCount, abort.signal);
    const requestCtx = this.buildRequestContext(msg, correlationId, tenantId);

    try {
      await requestContext.run(requestCtx, () =>
        this.executeHandler(handler, payload, ctx, config.handlerTimeout),
      );
      msg.ack();
    } catch (err) {
      if (err instanceof HandlerTimeoutError) {
        abort.abort();
      }
      await this.handleFailure(
        pattern,
        msg,
        ctx,
        err,
        payload,
        config,
        deliveryCount,
        correlationId,
        tenantId,
      );
    }
  }

  /**
   * Handle deserialization errors: publish to DLQ and terminate, or nak on DLQ failure.
   */
  private async handleDeserializationError(
    msg: JsMsg,
    err: unknown,
    deliveryCount: number,
    correlationId: string,
    tenantId: string | undefined,
  ): Promise<void> {
    const error = new DeserializationError(
      `Failed to deserialize message on "${msg.subject}": ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
    this.logger.error(error.message);

    try {
      await publishToDlq(
        this.js,
        msg.subject,
        msg.data,
        error.message,
        deliveryCount,
        correlationId,
        tenantId,
      );
      msg.term('deserialization_error');
    } catch (dlqErr) {
      this.logger.error(
        `Failed to publish deserialization error to DLQ: ${dlqErr instanceof Error ? dlqErr.message : String(dlqErr)}`,
      );
      msg.nak(60_000);
    }
  }

  /**
   * Build JetStreamContext from message metadata.
   */
  private buildContext(
    msg: JsMsg,
    config: ResolvedConsumerConfig,
    deliveryCount: number,
    signal: AbortSignal,
  ): JetStreamContext {
    const meta: JetStreamMeta = {
      stream: config.stream,
      durableName: config.durable,
      deliveryCount,
      sequence: {
        stream: msg.info.streamSequence,
        consumer: msg.info.deliverySequence,
      },
    };

    const ctx = new JetStreamContext([msg.subject, msg.headers, meta]);
    ctx.signal = signal;
    return ctx;
  }

  /**
   * Build RequestContext from NATS headers for AsyncLocalStorage propagation.
   */
  private buildRequestContext(
    msg: JsMsg,
    correlationId: string,
    tenantId: string | undefined,
  ): RequestContext {
    return {
      tenantId: tenantId || null,
      resellerId: msg.headers?.get('reseller-id') || null,
      userId: msg.headers?.get('actor-id') || '',
      scope: (msg.headers?.get('scope') as AuthScope) || 'institute',
      impersonatorId: msg.headers?.get('impersonator-id') || null,
      correlationId,
    };
  }

  /**
   * Handle handler execution failure: log, exponential backoff, DLQ on exhaustion.
   */
  private async handleFailure(
    pattern: string,
    msg: JsMsg,
    ctx: JetStreamContext,
    err: unknown,
    payload: unknown,
    config: ResolvedConsumerConfig,
    deliveryCount: number,
    correlationId: string,
    tenantId: string | undefined,
  ): Promise<void> {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (deliveryCount >= config.maxDeliver) {
      await this.sendToDlqOrNak(msg, payload, errorMessage, deliveryCount, correlationId, tenantId);
    } else {
      this.nakWithBackoff(msg, ctx, pattern, config, deliveryCount, errorMessage);
    }
  }

  /**
   * Attempt to publish to DLQ and terminate, or nak with long delay on DLQ failure.
   */
  private async sendToDlqOrNak(
    msg: JsMsg,
    payload: unknown,
    errorMessage: string,
    deliveryCount: number,
    correlationId: string,
    tenantId: string | undefined,
  ): Promise<void> {
    try {
      await publishToDlq(
        this.js,
        msg.subject,
        payload,
        errorMessage,
        deliveryCount,
        correlationId,
        tenantId,
      );
      msg.term('max_retries_exhausted');
    } catch (dlqErr) {
      this.logger.error(
        `Failed to publish to DLQ after max retries: ${dlqErr instanceof Error ? dlqErr.message : String(dlqErr)}`,
      );
      msg.nak(60_000);
    }
  }

  /**
   * Nak with exponential backoff, respecting handler-set nak delay.
   */
  private nakWithBackoff(
    msg: JsMsg,
    ctx: JetStreamContext,
    pattern: string,
    config: ResolvedConsumerConfig,
    deliveryCount: number,
    errorMessage: string,
  ): void {
    const baseDelay = this.jsOptions.retry?.baseDelay ?? 1_000;
    const maxDelay = this.jsOptions.retry?.maxDelay ?? 60_000;
    const nakDelay = ctx.getNakDelay() ?? Math.min(baseDelay * 2 ** (deliveryCount - 1), maxDelay);
    msg.nak(nakDelay);
    this.logger.warn(
      `Handler failed for "${pattern}", nak with ${nakDelay}ms delay ` +
        `(delivery ${deliveryCount}/${config.maxDeliver}): ${errorMessage}`,
    );
  }

  /**
   * Execute the handler with a timeout using Promise.race.
   * The AbortController signal is set on the context so handlers
   * can cooperatively cancel long-running operations.
   */
  private executeHandler(
    handler: MessageHandler,
    payload: unknown,
    ctx: JetStreamContext,
    timeout: number,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout>;

    return Promise.race([
      handler(payload, ctx).finally(() => clearTimeout(timer)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new HandlerTimeoutError(timeout));
        }, timeout);
      }),
    ]);
  }

  /**
   * Resolve consumer configuration from pattern and optional extras,
   * applying defaults and stream inference.
   */
  private resolveConsumerConfig(pattern: string, extras?: ConsumerExtras): ResolvedConsumerConfig {
    // biome-ignore lint/style/noNonNullAssertion: pattern always has at least one segment
    const inferredStream = pattern.split('.')[0]!.toUpperCase();
    const stream = extras?.stream ?? inferredStream;

    const durable = extras?.durable ?? pattern.replace(/[.>*]/g, '-').toLowerCase();

    // Find maxDeliver from the matching stream config, or default to 3
    const streamConfig = this.jsOptions.streams.find((s) => s.name === stream);
    const maxDeliver = extras?.maxDeliver ?? streamConfig?.maxDeliver ?? 3;

    const concurrency = extras?.concurrency ?? 1;
    const handlerTimeout = extras?.handlerTimeout ?? 25_000;

    const globalPull = this.jsOptions.pull;
    const pull = {
      batchSize: extras?.pull?.batchSize ?? globalPull?.batchSize ?? 10,
      idleHeartbeat: extras?.pull?.idleHeartbeat ?? globalPull?.idleHeartbeat ?? 30_000,
      expires: extras?.pull?.expires ?? globalPull?.expires ?? 60_000,
    };

    return {
      stream,
      durable,
      maxDeliver,
      concurrency,
      handlerTimeout,
      pull,
    };
  }

  /**
   * Stop all ConsumerMessages iterators and close the NATS connection.
   */
  override async close(): Promise<void> {
    for (const [durable, messages] of this.consumers) {
      try {
        messages.stop();
        this.logger.log(`Consumer "${durable}" stopped`);
      } catch (err) {
        this.logger.error(
          `Error stopping consumer "${durable}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.consumers.clear();
    await super.close();
  }
}
