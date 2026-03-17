# @roviq/nats-jetstream — Usage Guide

NestJS custom transport for NATS JetStream. Provides `@EventPattern`/`@MessagePattern` decorator support with durable pull consumers, automatic context propagation, DLQ, retry with exponential backoff, and concurrency control.

**Replaces:** `@roviq/nats-utils` (deleted)

## Quick Start

### Server (consumer side)

```typescript
// main.ts
import { JetStreamServer, STREAMS } from '@roviq/nats-jetstream';

app.connectMicroservice<MicroserviceOptions>({
  strategy: new JetStreamServer({
    servers: [config.get('NATS_URL')],
    streams: Object.values(STREAMS),
    dlq: { enabled: true },
  }),
});
await app.startAllMicroservices();
```

### Client (publisher side)

```typescript
// app.module.ts
import { JetStreamClient } from '@roviq/nats-jetstream';

{
  provide: 'JETSTREAM_CLIENT',
  useFactory: async (config: ConfigService) => {
    const client = new JetStreamClient({
      servers: [config.getOrThrow<string>('NATS_URL')],
    });
    await client.connect();
    return client;
  },
  inject: [ConfigService],
}
```

---

## Publishing Events

### Basic publish

```typescript
@Inject('JETSTREAM_CLIENT') private readonly client: ClientProxy;

// Fire-and-forget — emit() is hot, auto-subscribes
this.client.emit('NOTIFICATION.approval.requested', { approvalId, tenantId });
```

Headers (`correlation-id`, `tenant-id`, `actor-id`, `impersonator-id`) are **auto-injected** from AsyncLocalStorage. No manual header passing needed inside request handlers.

### Awaitable publish (for critical events)

```typescript
import { lastValueFrom } from 'rxjs';

const pubAck = await lastValueFrom(
  this.client.emit('AUDIT.log', event),
);
// pubAck contains { stream: 'AUDIT', seq: 42 }
```

### Out-of-context publishing (cron, Temporal, onModuleInit)

When there's no request context in AsyncLocalStorage, pass headers explicitly:

```typescript
import { NatsRecordBuilder } from '@nestjs/microservices';
import { headers } from '@nats-io/nats-core';

const hdrs = headers();
hdrs.set('correlation-id', jobId);
hdrs.set('tenant-id', tenantId);

const record = new NatsRecordBuilder(payload).setHeaders(hdrs).build();
this.client.emit('NOTIFICATION.fee.overdue', record);
```

---

## Consuming Events

### Basic handler

```typescript
import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';

@Controller()
export class AttendanceListener {
  @EventPattern('NOTIFICATION.attendance.absent', {
    stream: 'NOTIFICATION',
    durable: 'notification-attendance',
  })
  async handle(
    @Payload() event: AttendanceAbsentEvent,
    @Ctx() ctx: JetStreamContext,
  ) {
    // Handler runs inside AsyncLocalStorage with request context restored
    await this.notificationService.trigger(event);
    // msg.ack() called automatically on success
  }
}
```

### Wildcard handler (multiple subjects, shared durable)

Use when handling logic is shared or trivially branched:

```typescript
@EventPattern('NOTIFICATION.approval.*', {
  stream: 'NOTIFICATION',
  durable: 'notification-approval',
})
async handle(
  @Payload() event: ApprovalEvent,
  @Ctx() ctx: JetStreamContext,
) {
  const subject = ctx.getSubject();
  if (subject.endsWith('.requested')) {
    await this.handleRequested(event);
  } else if (subject.endsWith('.resolved')) {
    await this.handleResolved(event);
  }
}
```

### Separate handlers (distinct durables)

Prefer when logic diverges or handlers need different concurrency/timeout:

```typescript
@EventPattern('NOTIFICATION.approval.requested', {
  durable: 'notification-approval-requested',
})
async handleRequested(@Payload() event: ApprovalRequestedEvent) { /* ... */ }

@EventPattern('NOTIFICATION.approval.resolved', {
  durable: 'notification-approval-resolved',
})
async handleResolved(@Payload() event: ApprovalResolvedEvent) { /* ... */ }
```

### JetStreamContext API

```typescript
ctx.getSubject()         // 'NOTIFICATION.approval.requested'
ctx.getStream()          // 'NOTIFICATION'
ctx.getDurableName()     // 'notification-approval'
ctx.getDeliveryCount()   // 1 (1-based)
ctx.getSequence()        // { stream: 42, consumer: 7 }
ctx.getCorrelationId()   // from headers
ctx.getTenantId()        // from headers, or undefined
ctx.getHeaders()         // raw NATS headers object
ctx.signal               // AbortSignal for cooperative cancellation (optional)
ctx.setNakDelay(5000)    // override backoff delay for this message
```

### Cooperative cancellation

For long-running handlers, check the abort signal between steps:

```typescript
async handle(@Payload() event: HeavyEvent, @Ctx() ctx: JetStreamContext) {
  await this.step1(event);
  if (ctx.signal?.aborted) return;
  await this.step2(event);
  if (ctx.signal?.aborted) return;
  await this.step3(event);
}
```

---

## ConsumerExtras — Full Options

```typescript
@EventPattern('NOTIFICATION.approval.requested', {
  stream: 'NOTIFICATION',          // inferred from subject if omitted
  durable: 'notification-approval', // slugified from subject if omitted
  maxDeliver: 5,                    // from stream config if omitted
  concurrency: 3,                   // default 1 (sequential)
  handlerTimeout: 15_000,           // default 25_000ms
  pull: {
    batchSize: 20,                  // default 10
    idleHeartbeat: 15_000,          // default 30_000ms
    expires: 30_000,                // default 60_000ms
  },
})
```

---

## Stream Configuration

Streams are defined in `STREAMS` constant and auto-created on server startup:

| Stream | Subjects | Retention | maxDeliver | Purpose |
|---|---|---|---|---|
| INSTITUTE | `INSTITUTE.>` | workqueue | 3 | Institute domain events |
| ADMIN | `ADMIN.>` | workqueue | 3 | Platform admin events |
| NOTIFICATION | `NOTIFICATION.>` | workqueue | 5 | User notifications |
| AUDIT | `AUDIT.>` | limits | 5 | Audit log events |
| BILLING | `BILLING.>` | workqueue | 3 | Billing/payment events |
| DLQ | `DLQ.>` | limits | 1 | Dead Letter Queue |

### Adding a new stream

1. Add to `STREAMS` in `libs/backend/nats-jetstream/src/streams/stream.config.ts`
2. Publishers emit to `STREAMNAME.entity.action` subjects
3. Consumers use `@EventPattern('STREAMNAME.entity.action', { stream: 'STREAMNAME', durable: '...' })`

### Stream inference

When `stream` is omitted from `@EventPattern` extras, the server infers it by uppercasing the first segment:

```
'NOTIFICATION.approval.requested' → stream 'NOTIFICATION'
'BILLING.webhook.razorpay'        → stream 'BILLING'
```

---

## Error Handling

### Retry with exponential backoff

On handler failure, messages are nak'd with increasing delay:

```
Delivery 1 → nak(1s)
Delivery 2 → nak(2s)
Delivery 3 → nak(4s)
Delivery 4 → nak(8s)
...capped at 60s
```

Override per-message via `ctx.setNakDelay(ms)`.

Configure globally via server options:
```typescript
new JetStreamServer({
  retry: { baseDelay: 1_000, maxDelay: 60_000 },
})
```

### Dead Letter Queue (DLQ)

After `maxDeliver` retries exhausted:
1. Message published to `DLQ.<ORIGIN_STREAM>` (e.g. `DLQ.NOTIFICATION`)
2. Original message terminated

DLQ payload includes: `originalSubject`, `payload`, `error`, `retryCount`, `correlationId`, `tenantId`, `failedAt`.

**Safe DLQ**: If DLQ publish fails, message is nak'd with 60s delay instead of terminated. Message is never lost unless both handler AND DLQ are broken.

### Deserialization errors

Malformed payloads (can't parse JSON) are immediately sent to DLQ and terminated — no retries (pointless for garbage data).

### Handler timeout

Default: 25s (`handlerTimeout`). Must be less than NATS `ack_wait` (default 30s).

On timeout:
- AbortSignal fires (cooperative cancellation)
- Message nak'd with backoff
- **Handler continues running** — timeout only frees the consumer slot
- Handlers must be idempotent

---

## Concurrency

Default: sequential (`concurrency: 1`). Opt-in with:

```typescript
@EventPattern('NOTIFICATION.user.*', {
  durable: 'notification-user-sync',
  concurrency: 5,
})
```

Uses an internal semaphore. At `concurrency: 1`, zero overhead (same as no semaphore).

---

## Audit Consumer (Special Case)

The audit consumer (`audit.consumer.ts`) does batched pull consumption (50 msgs / 500ms flush). It stays **outside** the transport with its own raw `NatsConnection`. It imports `publishToDlq` and `ensureStreams` from `@roviq/nats-jetstream` but does not use `@EventPattern`.

---

## Conventions

1. **Stream names are UPPERCASE** — `NOTIFICATION`, `BILLING`, `DLQ`
2. **Subject format** — `STREAM.entity.action` (e.g. `NOTIFICATION.approval.requested`)
3. **`handlerTimeout` < `ack_wait`** — default 25s vs NATS default 30s
4. **Handlers must be idempotent** — JetStream guarantees at-least-once, not exactly-once
5. **Out-of-context publishing** uses `NatsRecordBuilder` with explicit headers
6. **DLQ subject** — `DLQ.<ORIGIN_STREAM>`, full original subject in payload

---

## Troubleshooting

### `void client.emit(...)` silently drops events
This was the old `ClientProxy.emit()` behavior (cold Observable). `JetStreamClient.emit()` is hot — it fires immediately. If you still see dropped events, check that the client is connected (`await client.connect()` in the provider factory).

### Missing request context warning
```
JetStreamClient: No request context (cron/Temporal/onModuleInit?)
```
You're publishing outside a request handler. Use `NatsRecordBuilder` with explicit headers.

### Config drift on rolling deploys
If you change a stream's subjects or maxDeliver and do a rolling deploy, old instances may have old config. The server handles this with `streams.add()` → fallback to `streams.update()`. **Immutable fields** (retention, storage) cannot be auto-updated — require manual migration.

### Consumer not receiving messages
Check that the `filter_subject` matches your published subject. Wildcard `*` matches one token, `>` matches one or more. The server uses the `@EventPattern` subject as the `filter_subject`.
