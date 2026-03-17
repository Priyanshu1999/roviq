# NestJS JetStream Custom Transport

**Date:** 2026-03-17
**Status:** Approved
**Replaces:** `@roviq/nats-utils` (libs/backend/nats-utils)

## Problem

The existing `@roviq/nats-utils` library provides JetStream pub/sub, DLQ, stream management, and context propagation via raw functions (`publish()`, `subscribe()`, `ensureStreams()`). This works but is non-idiomatic NestJS — it bypasses the framework's microservice transport layer, resulting in manual NATS connection wiring, raw function calls scattered across services, and no integration with `@EventPattern`, `@MessagePattern`, `@Payload()`, `@Ctx()`, or `ClientProxy`.

NestJS's built-in `Transport.NATS` uses core NATS (fire-and-forget pub/sub), not JetStream. It has no support for streams, durable consumers, at-least-once delivery, or DLQ. There is no built-in JetStream transport ([nestjs/nest#13198](https://github.com/nestjs/nest/issues/13198)).

## Solution

Build a custom NestJS transport — `@roviq/nats-jetstream` — by extending `ServerNats` and `ClientNats`. This reuses NestJS's connection lifecycle, serialization, and message routing, and overrides only the message dispatch/consumption layer to use JetStream.

After migration, `@roviq/nats-utils` is deleted entirely.

## Approach: Extend ServerNats/ClientNats

Chosen over two alternatives:

- **Full custom transport from scratch:** Most code (~500-700 lines), duplicates NestJS's connection management. Rejected.
- **Custom transport with composition:** No coupling to ServerNats internals but requires re-implementing message routing (~400-500 lines). Rejected.
- **Extend ServerNats/ClientNats (chosen):** Reuses ~60% of NestJS NATS transport. ~250-350 lines of new code. `@EventPattern`/`@MessagePattern`/`@Payload()`/`@Ctx()` work automatically. Trade-off: coupled to ServerNats internals, manageable since the core shape has been stable across v10-v11.

---

## Library Structure

**Package:** `@roviq/nats-jetstream`
**Location:** `libs/backend/nats-jetstream/`

```
libs/backend/nats-jetstream/src/
├── server/
│   └── jetstream.server.ts         # JetStreamServer extends ServerNats
├── client/
│   └── jetstream.client.ts         # JetStreamClient extends ClientNats
├── context/
│   └── jetstream.context.ts        # JetStreamContext extends NatsContext
├── serializers/
│   └── context-propagation.serializer.ts
├── deserializers/
│   └── context-propagation.deserializer.ts
├── streams/
│   ├── stream.config.ts            # STREAMS constant
│   └── stream.manager.ts           # ensureStreams + ensureConsumers
├── dlq/
│   └── dlq.handler.ts              # publishToDlq
├── interfaces/
│   └── jetstream.options.ts        # all option/config types
└── index.ts
```

**Separate lib:** Circuit breaker moves to `@roviq/resilience` (unrelated to NATS).

---

## Server: JetStreamServer extends ServerNats

### Inherited from ServerNats

- NATS connection lifecycle (connect, reconnect, close)
- Status monitoring (`_status$` observable)
- Serializer/deserializer pipeline
- `messageHandlers` map (routes patterns to handler functions)
- `handleEvent()` dispatch

### Overridden Methods

| Method | ServerNats | JetStreamServer |
|---|---|---|
| `listen()` | Core NATS subscriptions | `ensureStreams()` + `ensureConsumers()`, then JetStream pull consumers |
| `bindEvents()` | Core NATS subscription per pattern | JetStream pull consumer per pattern with `consume()` iterator |
| `handleMessage()` | Parses core NATS msg | Parses JetStream msg, restores request context, routes to handler, manages ack/nak/dlq |
| `close()` | Drains subscriptions | Stops all `ConsumerMessages` iterators, then `super.close()` |

### Configuration

```typescript
interface JetStreamServerOptions {
  servers: string[];
  streams: StreamConfig[];
  dlq?: {
    enabled: boolean;       // default true
    stream?: string;        // default 'DLQ'
  };
  contextPropagation?: boolean;   // default true
  pull?: {
    batchSize?: number;           // default 10
    idleHeartbeat?: number;       // ms, default 30_000
    expires?: number;             // ms, default 60_000
  };
  retry?: {
    baseDelay?: number;           // ms, default 1_000
    maxDelay?: number;            // ms, default 60_000
  };
}
```

### Stream Creation — Idempotent with Update Fallback

Multiple instances can race on startup. NATS `streams.add()` is idempotent only if config is identical. To handle config changes on rolling deploys:

```
try streams.add(config)
catch 10058 (stream name in use, different config):
    streams.update(name, config)    // safe for additive changes
```

**Key constraint:** `streams.update()` cannot change immutable fields — `retention` and `storage` type. Attempting to update from `workqueue` to `limits` (or vice versa) will fail. Such changes require manual migration: delete the stream and recreate it (which means message loss). The implementation must validate this and throw a clear error if the caller's config differs on immutable fields, rather than letting NATS return a cryptic error.

### DLQ Stream Auto-Creation

If `dlq.enabled` is true (the default), the server automatically ensures the DLQ stream exists — even if the caller omits `STREAMS.DLQ` from the `streams` config array. This prevents a silent failure where DLQ publishes fail because the stream doesn't exist.

```
listen():
  → ensureStreams(config.streams)
  → if dlq.enabled AND dlq.stream not in config.streams:
      → auto-create DLQ stream with defaults:
        { name: 'DLQ', subjects: ['DLQ.>'], retention: 'limits', storage: 'file', maxDeliver: 1 }
  → ensureConsumers(...)
```

### Stream Inference Convention

When `@EventPattern` extras omit `stream`, the server infers it by uppercasing the first segment of the subject:

```
'NOTIFICATION.approval.requested' → stream 'NOTIFICATION'
'audit.log'                       → stream 'AUDIT'
```

All stream names in the `STREAMS` constant are uppercase by convention.

### Handler Registration

```typescript
// Minimal — server infers stream and durable name
@EventPattern('NOTIFICATION.approval.requested')
async handle(@Payload() event: ApprovalRequestedEvent, @Ctx() ctx: JetStreamContext) {}

// Explicit — full control
@EventPattern('NOTIFICATION.approval.requested', {
  stream: 'NOTIFICATION',
  durable: 'notification-approval',
  maxDeliver: 5,
  concurrency: 3,
  handlerTimeout: 15_000,
  pull: { batchSize: 20 },
})
async handle(@Payload() event: ApprovalRequestedEvent, @Ctx() ctx: JetStreamContext) {}
```

### Wildcard Subjects and Shared Durable Consumers

Some current listeners subscribe to multiple subjects via one wildcard consumer (e.g. `NOTIFICATION.approval.>` handles both `requested` and `resolved`). Two patterns are supported:

**Pattern A: Wildcard with shared durable** — use when handling logic is genuinely shared or trivially branched (2-3 sub-events):

```typescript
@EventPattern('NOTIFICATION.approval.*', {
  stream: 'NOTIFICATION',
  durable: 'notification-approval',
})
async handle(@Payload() event: ApprovalEvent, @Ctx() ctx: JetStreamContext) {
  const subject = ctx.getSubject();
  if (subject.endsWith('.requested')) {
    await this.handleRequested(event as ApprovalRequestedEvent);
  } else if (subject.endsWith('.resolved')) {
    await this.handleResolved(event as ApprovalResolvedEvent);
  }
}
```

When the subject contains `*` or `>`, the server uses it as the consumer's `filter_subject` directly. Two `@EventPattern` handlers sharing the same `durable` name is NOT supported — use a single wildcard handler per durable.

**Pattern B: Separate handlers with distinct durables** — use when handling logic diverges significantly or there are many sub-events (avoids if/else dispatch at scale):

```typescript
@EventPattern('NOTIFICATION.approval.requested', { durable: 'notification-approval-requested' })
async handleRequested(@Payload() event: ApprovalRequestedEvent) { /* ... */ }

@EventPattern('NOTIFICATION.approval.resolved', { durable: 'notification-approval-resolved' })
async handleResolved(@Payload() event: ApprovalResolvedEvent) { /* ... */ }
```

Each handler gets its own durable consumer with its own delivery tracking. Prefer this when the handlers have different retry/concurrency/timeout needs.

### ConsumerExtras Interface

```typescript
interface ConsumerExtras {
  stream?: string;              // inferred from subject if omitted
  durable?: string;             // inferred from subject if omitted
  maxDeliver?: number;          // from stream config if omitted
  concurrency?: number;         // default 1
  handlerTimeout?: number;      // ms, default 25_000 (must be < ack_wait)
  pull?: {
    batchSize?: number;         // default 10
    idleHeartbeat?: number;     // ms, default 30_000
    expires?: number;           // ms, default 60_000
  };
}
```

### Pull Consumer Lifecycle in bindEvents()

```typescript
class JetStreamServer extends ServerNats {
  private consumers = new Map<string, ConsumerMessages>();

  async bindEvents(client: Client): void {
    const js = jetstream(client);

    for (const [pattern, handler] of this.messageHandlers) {
      const config = this.resolveConsumerConfig(pattern, handler.extras);
      const consumer = await js.consumers.get(config.stream, config.durable);
      const messages = await consumer.consume({
        max_messages: config.pull?.batchSize ?? 10,
        idle_heartbeat: config.pull?.idleHeartbeat ?? 30_000,
        expires: config.pull?.expires ?? 60_000,
      });

      this.consumers.set(config.durable, messages);
      void this.consumeLoop(pattern, messages, handler, config);
    }
  }

  async close(): Promise<void> {
    for (const [_, messages] of this.consumers) {
      messages.stop();
    }
    this.consumers.clear();
    await super.close();
  }
}
```

**Implementation note:** `idle_heartbeat` units may differ between NATS protocol (nanoseconds) and the JS client (milliseconds). Verify against the exact `@nats-io/jetstream` version installed during implementation.

### Concurrency — Semaphore per Consumer

Sequential by default (`concurrency: 1`). Opt-in parallelism via a lightweight semaphore (~15 lines, no external dependency):

```typescript
private async consumeLoop(pattern, messages, handler, config) {
  const maxConcurrency = config.concurrency ?? 1;
  const semaphore = new Semaphore(maxConcurrency);

  for await (const msg of messages) {
    await semaphore.acquire();
    void this.processMessage(pattern, msg, handler, config)
      .finally(() => semaphore.release());
  }
}
```

For `concurrency: 1`, this degrades to sequential with zero overhead.

### Message Lifecycle in processMessage()

```
msg received from consume() iterator
  → semaphore.acquire()
  → try:
      → deserialize payload (can throw on malformed data)
      → extract headers → restore RequestContext into AsyncLocalStorage
      → create JetStreamContext (subject, headers, stream, deliveryCount)
      → set ctx.signal from AbortController
      → executeHandler(handler, payload, ctx, handlerTimeout)
      → msg.ack()
    catch DeserializationError:
      → log error
      → try publishToDlq() → msg.term()
      → catch DLQ failure → msg.nak(LONG_DELAY)
    catch HandlerTimeoutError:
      → abort.abort()  (signal cooperative cancellation)
      → treat as normal failure (nak with backoff)
    catch handler failure:
      → if deliveryCount < maxRetries:
          delay = ctx.nakDelay ?? min(baseDelay * 2^(count-1), maxDelay)
          msg.nak(delay)
      → if deliveryCount >= maxRetries:
          try publishToDlq() → success → msg.term()
          catch DLQ failure → msg.nak(LONG_DELAY)
  → finally: semaphore.release()
```

Key safety properties:

- **Nak with exponential backoff** — bare `nak()` causes retry storms. Default: `1s * 2^(delivery-1)`, capped at 60s. Overridable via `ctx.setNakDelay(ms)`.
- **Safe DLQ** — if DLQ publish fails, message is nak'd with long delay instead of term'd. Message only lost if both handler AND DLQ are broken AND retries exhaust.
- **Deserialization failure** — term'd immediately (no point retrying garbage), but still captured in DLQ for debugging.
- **Semaphore always released** — `processMessage()` wraps everything (deserialize, context, handler, ack/nak/dlq) in a single try/finally.

### Handler Timeout

```typescript
private executeHandler(handler, payload, ctx, timeout = 25_000) {
  const abort = new AbortController();
  ctx.signal = abort.signal;

  let timer: NodeJS.Timeout;
  return Promise.race([
    handler(payload, ctx).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new HandlerTimeoutError(timeout));
      }, timeout);
    }),
  ]);
}
```

**Timeout does not cancel handler execution.** The timed-out handler continues running. This is by design — handlers must be idempotent regardless (NATS guarantees at-least-once, not exactly-once). The timeout only unblocks the consumer slot and naks the message. Handlers that do long work can check `ctx.signal?.aborted` for cooperative cancellation.

**Convention:** `handlerTimeout` must be less than the consumer's `ack_wait`. If `ack_wait` is 30s (NATS default), set `handlerTimeout` to 25s max. Otherwise JetStream redelivers before timeout fires, causing duplicate processing.

---

## Client: JetStreamClient extends ClientNats

### Inherited from ClientNats

- Connection lifecycle (connect, reconnect, close)
- Status monitoring
- Serializer pipeline
- `send()` — request/response (returns Observable)
- Header merging via `mergeHeaders()`

### Overridden Methods

| Method | ClientNats | JetStreamClient |
|---|---|---|
| `dispatchEvent()` | `natsClient.publish()` (core NATS) | `js.publish()` (JetStream, persisted to stream) |
| `mergeHeaders()` | Merges user-provided headers | Also auto-injects correlation-id, tenant-id, actor-id, impersonator-id from AsyncLocalStorage |
| `emit()` | Returns cold Observable | Returns hot Observable via ReplaySubject (auto-subscribes) |
| `connect()` | Connects to NATS | `super.connect()` + stores JetStream client ref |

### `send()` stays on core NATS

JetStream is for durable events, not request/response. `send()` (request/response) continues to use core NATS. `emit()` (events) uses JetStream.

### Hot Observable emit()

NestJS `ClientProxy.emit()` returns a cold Observable. If nobody subscribes, `dispatchEvent()` never runs — `void this.client.emit(...)` silently drops the event. This is a known NestJS gotcha.

Fix: override `emit()` to auto-subscribe and return a hot Observable:

```typescript
emit<TResult = PubAck, TInput = any>(pattern: any, data: TInput): Observable<TResult> {
  const cold$ = super.emit<TResult, TInput>(pattern, data);

  const subject = new ReplaySubject<TResult>(1);
  cold$.subscribe({
    next: (v) => subject.next(v),
    error: (err) => {
      this.logger.error(`JetStream publish failed [${pattern}]`, err.message);
      subject.error(err);
    },
    complete: () => subject.complete(),
  });

  return subject.asObservable();
}
```

- `void this.client.emit(...)` — fires, errors logged, no crash
- `this.client.emit(...).subscribe()` — caller gets PubAck or error
- `await lastValueFrom(this.client.emit(...))` — awaitable for critical publishes

### Context Propagation in mergeHeaders()

Auto-injects request context when available, warns when not:

```typescript
mergeHeaders(requestHeaders?: any): MsgHdrs {
  const hdrs = super.mergeHeaders(requestHeaders);
  const ctx = requestContext.getStore();

  if (ctx) {
    hdrs.set('correlation-id', ctx.correlationId);
    hdrs.set('tenant-id', ctx.tenantId ?? '');
    hdrs.set('actor-id', ctx.userId ?? '');
    hdrs.set('impersonator-id', ctx.impersonatorId ?? '');
  } else {
    this.logger.warn(
      'JetStreamClient: No request context (cron/Temporal/onModuleInit?). ' +
      'Pass headers explicitly via NatsRecordBuilder.',
    );
    hdrs.set('correlation-id', crypto.randomUUID());
  }

  return hdrs;
}
```

Out-of-context callers pass headers explicitly:

```typescript
const headers = nats.headers();
headers.set('correlation-id', jobId);
headers.set('tenant-id', tenantId);

const record = new NatsRecordBuilder(payload).setHeaders(headers).build();
this.client.emit('NOTIFICATION.fee.overdue', record);
```

### Registration

```typescript
// Primary: ClientsModule
ClientsModule.register([{
  name: 'JETSTREAM_CLIENT',
  customClass: JetStreamClient,
  options: { servers: ['nats://localhost:4222'] },
}])

// Fallback (if ClientsModule strips unknown keys from options):
{
  provide: 'JETSTREAM_CLIENT',
  useFactory: () => new JetStreamClient({
    servers: ['nats://localhost:4222'],
    contextPropagation: true,
  }),
}
```

**Implementation note:** Verify that `ClientsModule.register()` with `customClass` passes all options through to the constructor. If NestJS strips unrecognized keys, use the custom provider fallback.

---

## Context: JetStreamContext

Extends `NatsContext`. Exposes JetStream metadata to handlers.

```typescript
class JetStreamContext extends NatsContext {
  public signal?: AbortSignal;        // optional, set by processMessage before handler

  // Inherited
  getSubject(): string;
  getHeaders(): MsgHdrs;

  // JetStream-specific
  getStream(): string;
  getDurableName(): string;
  getDeliveryCount(): number;         // 1-based
  getSequence(): { stream: number; consumer: number };
  getCorrelationId(): string;         // shorthand
  getTenantId(): string | undefined;  // shorthand

  // Handler can override nak delay
  setNakDelay(ms: number): void;
  getNakDelay(): number | undefined;
}
```

---

## DLQ

### Subject Pattern

`DLQ.<ORIGIN_STREAM>` — derived from the first segment of the original subject, uppercased:

```
'NOTIFICATION.approval.requested' → 'DLQ.NOTIFICATION'
'AUDIT.log'                       → 'DLQ.AUDIT'
'INSTITUTE.member.updated'        → 'DLQ.INSTITUTE'
```

Full original subject preserved in `DlqMessage.originalSubject`. Filter by origin stream when debugging (`DLQ.NOTIFICATION`, `DLQ.>` for all).

### DlqMessage Type

```typescript
interface DlqMessage<T = unknown> {
  originalSubject: string;
  payload: T;
  error: string;
  retryCount: number;
  correlationId: string;
  tenantId?: string;
  failedAt: string;             // ISO 8601
}
```

### publishToDlq

Used internally by `JetStreamServer.processMessage()`. Also exported for manual use by the audit consumer.

```typescript
async function publishToDlq<T>(
  js: JetStreamClient,           // nats.js JetStreamClient, not our ClientProxy
  originalSubject: string,
  payload: T,
  error: string,
  retryCount: number,
  correlationId: string,
  tenantId?: string,
): Promise<void>;
```

---

## Streams Configuration

```typescript
const STREAMS = {
  INSTITUTE:    { name: 'INSTITUTE',    subjects: ['INSTITUTE.>'],    retention: 'workqueue', storage: 'file', maxDeliver: 3 },
  ADMIN:        { name: 'ADMIN',        subjects: ['ADMIN.>'],        retention: 'workqueue', storage: 'file', maxDeliver: 3 },
  NOTIFICATION: { name: 'NOTIFICATION', subjects: ['NOTIFICATION.>'], retention: 'workqueue', storage: 'file', maxDeliver: 5 },
  AUDIT:        { name: 'AUDIT',        subjects: ['AUDIT.>'],        retention: 'limits',    storage: 'file', maxDeliver: 5 },
  BILLING:      { name: 'BILLING',      subjects: ['BILLING.>'],      retention: 'workqueue', storage: 'file', maxDeliver: 3 },
  DLQ:          { name: 'DLQ',          subjects: ['DLQ.>'],          retention: 'limits',    storage: 'file', maxDeliver: 1 },
} as const;
```

**Change from current nats-utils:** Added `BILLING` stream. Billing events were previously on core NATS (fire-and-forget). They now flow through JetStream for durable delivery. Billing subjects must be renamed from `billing.*` to `BILLING.*` to match the uppercase stream convention (e.g. `billing.subscription.canceled` → `BILLING.subscription.canceled`).

---

## Exports

```typescript
// Server
export { JetStreamServer } from './server/jetstream.server.js';
export type { JetStreamServerOptions } from './interfaces/jetstream.options.js';

// Client
export { JetStreamClient } from './client/jetstream.client.js';

// Context
export { JetStreamContext } from './context/jetstream.context.js';

// Streams
export { STREAMS, ensureStreams } from './streams/stream.manager.js';
export type { StreamConfig } from './streams/stream.config.js';

// DLQ (for audit consumer and manual use)
export { publishToDlq } from './dlq/dlq.handler.js';
export type { DlqMessage } from './dlq/dlq.handler.js';

// Types
export type { ConsumerExtras } from './interfaces/jetstream.options.js';
```

Circuit breaker is NOT exported here — it moves to `@roviq/resilience`.

---

## Migration Path

### Notification Service

**Before:** Hybrid app with `Transport.NATS` + manual JetStream consumers via `subscribe()`, manual `ensureStreams()`, manual `ensureConsumers()`.

**After:** Single `JetStreamServer` transport. Listeners use `@EventPattern` + `@Ctx() ctx: JetStreamContext`. Server handles streams, consumers, context propagation, retry, and DLQ automatically.

**Deleted files:**
- `apps/notification-service/src/nats/nats.provider.ts`
- `apps/notification-service/src/nats/nats.module.ts`
- `apps/notification-service/src/nats/ensure-consumers.ts`

### API Gateway (Publishers)

**Before:** Manual `NATS_CONNECTION` provider, raw `publish()` calls with explicit options.

**After:** `JetStreamClient` registered via `ClientsModule`. `client.emit()` with auto context propagation.

**Deleted files:**
- `apps/api-gateway/src/audit/nats.provider.ts`

### Audit Consumer (Batching)

**Stays outside the transport.** It keeps its raw JetStream pull consumer with batching (50 msgs / 500ms flush). Only import path changes: `@roviq/nats-utils` → `@roviq/nats-jetstream`.

### Billing Module

**Before:** Uses `ClientsModule` + `Transport.NATS` (core NATS, fire-and-forget). Publishes to lowercase subjects (`billing.plan.created`, `billing.plan.updated`, `billing.subscription.canceled`, `billing.webhook.razorpay`, etc.). Billing notification controller consumes via `@EventPattern('billing.subscription.*')` and `@EventPattern('billing.webhook.*')` on a separate core NATS microservice transport.

**After:** Migrates to `JetStreamClient` for publishing. Subjects renamed to uppercase convention (`BILLING.subscription.canceled`, `BILLING.webhook.razorpay`). New `BILLING` stream added to `STREAMS` constant. Billing notification controller's `@EventPattern` patterns updated to match. The notification-service now runs a single `JetStreamServer` transport instead of a hybrid setup.

**Changes:**
- `ee/apps/api-gateway/src/billing/billing.module.ts` — replace `BILLING_NATS_CLIENT` (`ClientsModule` + `Transport.NATS`) with `JetStreamClient`
- `ee/apps/api-gateway/src/billing/billing.service.ts` — update subject names to `BILLING.*`
- `apps/notification-service/src/controllers/billing-notification.controller.ts` — update `@EventPattern('billing.subscription.*')` → `@EventPattern('BILLING.subscription.*', { stream: 'BILLING', durable: 'notification-billing' })`, same for webhook patterns
- `apps/notification-service/src/main.ts` — remove separate `Transport.NATS` microservice (single `JetStreamServer` handles everything now)

### Files Summary

**Deleted:**
- `libs/backend/nats-utils/` (entire old lib)
- `apps/notification-service/src/nats/` (manual NATS wiring)
- `apps/api-gateway/src/audit/nats.provider.ts` (manual NATS provider)

**Created:**
- `libs/backend/nats-jetstream/` (new transport lib)
- `libs/backend/resilience/` (circuit breaker, extracted)

**Modified:**
- `apps/notification-service/src/main.ts` — single JetStreamServer transport (remove separate Transport.NATS)
- `apps/notification-service/src/listeners/*` — `@EventPattern` + `@Ctx`
- `apps/notification-service/src/controllers/billing-notification.controller.ts` — update `@EventPattern('billing.subscription.*')` → `@EventPattern('BILLING.subscription.*', { stream: 'BILLING', durable: 'notification-billing-subscription' })`, and `@EventPattern('billing.webhook.*')` → `@EventPattern('BILLING.webhook.*', { stream: 'BILLING', durable: 'notification-billing-webhook' })`
- `apps/api-gateway/src/app.module.ts` — register JetStreamClient
- `apps/api-gateway/src/auth/auth.resolver.ts` — inject client, use `emit()`
- `apps/api-gateway/src/audit/audit.module.ts` — remove natsProvider
- `apps/api-gateway/src/audit/audit.consumer.ts` — import from new lib
- `libs/backend/audit/src/audit-emitter.ts` — use JetStreamClient
- `ee/apps/api-gateway/src/billing/billing.module.ts` — replace `BILLING_NATS_CLIENT` (Transport.NATS) with JetStreamClient
- `ee/apps/api-gateway/src/billing/billing.service.ts` — update subject names to `BILLING.*`
- `tsconfig.json`, `package.json` — new lib path aliases

---

## Conventions

1. **Stream names are UPPERCASE.** Subject inference uppercases the first segment.
2. **Subject format:** `STREAM.entity.action` (e.g. `NOTIFICATION.approval.requested`).
3. **`handlerTimeout` < `ack_wait`.** Default handler timeout is 25s (NATS default `ack_wait` is 30s). Always keep `handlerTimeout` at least 5s less than `ack_wait` to prevent JetStream from redelivering before timeout fires.
4. **Handlers must be idempotent.** NATS guarantees at-least-once, not exactly-once. Timeout does not cancel handler execution.
5. **Out-of-context publishing** (cron, Temporal, `onModuleInit`) must use `NatsRecordBuilder` with explicit headers.
6. **DLQ subject:** `DLQ.<ORIGIN_STREAM>`. Full original subject in `DlqMessage.originalSubject`.

---

## Test Strategy

- **Unit tests** for `JetStreamServer` and `JetStreamClient`: mock the NATS connection and JetStream APIs. Test message routing, ack/nak/term lifecycle, DLQ publish, exponential backoff calculation, semaphore concurrency, handler timeout, and context propagation. Migrate and extend the existing `streams.test.ts` tests.
- **Integration tests**: use a real NATS server (via Docker in CI) to test stream/consumer creation idempotency, end-to-end publish → consume → ack flow, DLQ flow on handler failure, and rolling deploy config update scenarios.
- **Existing e2e tests**: update any e2e tests that depend on nats-utils imports to use the new `@roviq/nats-jetstream` package.

---

## Out of Scope

**Circuit breaker (`@roviq/resilience`):** The circuit breaker module in nats-utils is generic (uses `opossum`) and unrelated to NATS. It is extracted to a separate `@roviq/resilience` library as part of this work, but its API and tests are unchanged — it's a move, not a rewrite. This is a separate task tracked independently.
