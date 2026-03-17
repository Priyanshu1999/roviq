# NestJS JetStream Custom Transport — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@roviq/nats-utils` with an idiomatic NestJS custom transport (`@roviq/nats-jetstream`) that extends `ServerNats`/`ClientNats` for JetStream-backed pub/sub.

**Architecture:** Extend NestJS's `ServerNats` and `ClientNats` to override message dispatch/consumption with JetStream. Server creates streams/consumers on startup and routes messages to `@EventPattern` handlers. Client publishes via JetStream with auto context propagation.

**Tech Stack:** NestJS microservices (`@nestjs/microservices`), `@nats-io/jetstream`, `@nats-io/nats-core`, RxJS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-17-nats-jetstream-transport-design.md`

---

## Chunk 1: Library Scaffolding + Core Types + Stream Manager + DLQ

### Task 1: Scaffold `@roviq/nats-jetstream` NX library

**Files:**
- Create: `libs/backend/nats-jetstream/package.json`
- Create: `libs/backend/nats-jetstream/project.json`
- Create: `libs/backend/nats-jetstream/tsconfig.json`
- Create: `libs/backend/nats-jetstream/tsconfig.lib.json`
- Create: `libs/backend/nats-jetstream/vitest.config.ts`
- Create: `libs/backend/nats-jetstream/src/index.ts`
- Modify: `tsconfig.base.json` (add path alias)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@roviq/nats-jetstream",
  "version": "0.0.1",
  "private": true,
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "dependencies": {
    "tslib": "^2.3.0"
  }
}
```

- [ ] **Step 2: Create project.json**

```json
{
  "name": "nats-jetstream",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/backend/nats-jetstream/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/nats-jetstream",
        "main": "libs/backend/nats-jetstream/src/index.ts",
        "tsConfig": "libs/backend/nats-jetstream/tsconfig.lib.json",
        "assets": ["libs/backend/nats-jetstream/*.md"]
      }
    }
  },
  "tags": []
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "importHelpers": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```

- [ ] **Step 4: Create tsconfig.lib.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  resolve: {
    alias: {
      '@roviq/nats-jetstream': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/common-types': path.resolve(__dirname, '../../shared/common-types/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create empty src/index.ts**

```typescript
// @roviq/nats-jetstream — NestJS JetStream custom transport
```

- [ ] **Step 7: Add path alias to tsconfig.base.json**

Add to `compilerOptions.paths`:
```json
"@roviq/nats-jetstream": ["libs/backend/nats-jetstream/src/index.ts"]
```

- [ ] **Step 8: Verify build**

Run: `pnpm nx build nats-jetstream`
Expected: Successful build with no errors.

- [ ] **Step 9: Commit**

```bash
git add libs/backend/nats-jetstream/ tsconfig.base.json
git commit -m "feat(nats-jetstream): scaffold NX library"
```

---

### Task 2: Core interfaces and types

**Files:**
- Create: `libs/backend/nats-jetstream/src/interfaces/jetstream.options.ts`

- [ ] **Step 1: Write interface file**

```typescript
import type { NatsOptions } from '@nestjs/microservices';

export interface StreamConfig {
  name: string;
  subjects: readonly string[];
  retention: 'workqueue' | 'limits';
  storage: 'file' | 'memory';
  maxDeliver: number;
}

export interface DlqOptions {
  enabled: boolean;
  stream?: string;
}

export interface PullOptions {
  batchSize?: number;
  idleHeartbeat?: number;
  expires?: number;
}

export interface RetryOptions {
  baseDelay?: number;
  maxDelay?: number;
}

export interface JetStreamServerOptions extends Omit<Required<NatsOptions>['options'], never> {
  servers: string[];
  streams: StreamConfig[];
  dlq?: DlqOptions;
  contextPropagation?: boolean;
  pull?: PullOptions;
  retry?: RetryOptions;
}

export interface ConsumerExtras {
  stream?: string;
  durable?: string;
  maxDeliver?: number;
  concurrency?: number;
  handlerTimeout?: number;
  pull?: PullOptions;
}

export interface ResolvedConsumerConfig {
  stream: string;
  durable: string;
  maxDeliver: number;
  concurrency: number;
  handlerTimeout: number;
  pull: Required<PullOptions>;
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/backend/nats-jetstream/src/interfaces/
git commit -m "feat(nats-jetstream): add core interfaces"
```

---

### Task 3: Stream config and stream manager

**Files:**
- Create: `libs/backend/nats-jetstream/src/streams/stream.config.ts`
- Create: `libs/backend/nats-jetstream/src/streams/stream.manager.ts`
- Test: `libs/backend/nats-jetstream/src/streams/__tests__/stream.manager.test.ts`

- [ ] **Step 1: Write stream.config.ts**

Move `STREAMS` constant from `libs/backend/nats-utils/src/streams.ts`, adding the new BILLING stream:

```typescript
import type { StreamConfig } from '../interfaces/jetstream.options.js';

export const STREAMS: Record<string, StreamConfig> = {
  INSTITUTE:    { name: 'INSTITUTE',    subjects: ['INSTITUTE.>'],    retention: 'workqueue', storage: 'file', maxDeliver: 3 },
  ADMIN:        { name: 'ADMIN',        subjects: ['ADMIN.>'],        retention: 'workqueue', storage: 'file', maxDeliver: 3 },
  NOTIFICATION: { name: 'NOTIFICATION', subjects: ['NOTIFICATION.>'], retention: 'workqueue', storage: 'file', maxDeliver: 5 },
  AUDIT:        { name: 'AUDIT',        subjects: ['AUDIT.>'],        retention: 'limits',    storage: 'file', maxDeliver: 5 },
  BILLING:      { name: 'BILLING',      subjects: ['BILLING.>'],      retention: 'workqueue', storage: 'file', maxDeliver: 3 },
  DLQ:          { name: 'DLQ',          subjects: ['DLQ.>'],          retention: 'limits',    storage: 'file', maxDeliver: 1 },
};

export const DEFAULT_DLQ_STREAM: StreamConfig = STREAMS.DLQ;
```

- [ ] **Step 2: Write stream.manager.ts**

```typescript
import { JetStreamApiError, jetstreamManager, RetentionPolicy, StorageType } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { Logger } from '@nestjs/common';
import type { StreamConfig } from '../interfaces/jetstream.options.js';

const logger = new Logger('JetStreamStreamManager');

const RETENTION_MAP = {
  workqueue: RetentionPolicy.Workqueue,
  limits: RetentionPolicy.Limits,
} as const;

const STORAGE_MAP = {
  file: StorageType.File,
  memory: StorageType.Memory,
} as const;

export async function ensureStreams(nc: NatsConnection, streams: StreamConfig[]): Promise<void> {
  const jsm = await jetstreamManager(nc);

  for (const stream of streams) {
    try {
      await jsm.streams.add({
        name: stream.name,
        subjects: [...stream.subjects],
        retention: RETENTION_MAP[stream.retention],
        storage: STORAGE_MAP[stream.storage],
        max_deliver: stream.maxDeliver,
      });
      logger.log(`Stream "${stream.name}" ensured`);
    } catch (err) {
      if (err instanceof JetStreamApiError && err.code === 10058) {
        // Stream exists with different config — try update (additive changes only)
        try {
          await jsm.streams.update(stream.name, {
            subjects: [...stream.subjects],
            max_deliver: stream.maxDeliver,
          });
          logger.log(`Stream "${stream.name}" updated`);
        } catch (updateErr) {
          logger.error(`Failed to update stream "${stream.name}" — immutable field change? Requires manual migration.`, updateErr);
          throw updateErr;
        }
      } else {
        throw err;
      }
    }
  }
}
```

- [ ] **Step 3: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STREAMS, DEFAULT_DLQ_STREAM } from '../stream.config';

describe('STREAMS config', () => {
  it('defines all expected streams', () => {
    expect(Object.keys(STREAMS)).toEqual(
      expect.arrayContaining(['INSTITUTE', 'ADMIN', 'NOTIFICATION', 'AUDIT', 'BILLING', 'DLQ']),
    );
  });

  it('all stream names are uppercase', () => {
    for (const stream of Object.values(STREAMS)) {
      expect(stream.name).toBe(stream.name.toUpperCase());
    }
  });

  it('all subjects follow STREAM_NAME.> pattern', () => {
    for (const stream of Object.values(STREAMS)) {
      expect(stream.subjects[0]).toBe(`${stream.name}.>`);
    }
  });

  it('exports DEFAULT_DLQ_STREAM', () => {
    expect(DEFAULT_DLQ_STREAM).toBe(STREAMS.DLQ);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm nx test nats-jetstream`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add libs/backend/nats-jetstream/src/streams/
git commit -m "feat(nats-jetstream): add stream config and manager"
```

---

### Task 4: DLQ handler

**Files:**
- Create: `libs/backend/nats-jetstream/src/dlq/dlq.handler.ts`
- Test: `libs/backend/nats-jetstream/src/dlq/__tests__/dlq.handler.test.ts`

- [ ] **Step 1: Write dlq.handler.ts**

```typescript
import { jetstream } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { headers as natsHeaders } from '@nats-io/nats-core';

export interface DlqMessage<T = unknown> {
  originalSubject: string;
  payload: T;
  error: string;
  retryCount: number;
  correlationId: string;
  tenantId?: string;
  failedAt: string;
}

export async function publishToDlq<T>(
  js: NatsConnection,
  originalSubject: string,
  payload: T,
  error: string,
  retryCount: number,
  correlationId: string,
  tenantId?: string,
): Promise<void> {
  const jsClient = jetstream(js);
  const originStream = originalSubject.split('.')[0].toUpperCase();
  const dlqSubject = `DLQ.${originStream}`;

  const dlqPayload: DlqMessage<T> = {
    originalSubject,
    payload,
    error,
    retryCount,
    correlationId,
    tenantId,
    failedAt: new Date().toISOString(),
  };

  const hdrs = natsHeaders();
  hdrs.set('correlation-id', correlationId);
  if (tenantId) hdrs.set('tenant-id', tenantId);
  hdrs.set('dlq-reason', error);

  await jsClient.publish(dlqSubject, JSON.stringify(dlqPayload), { headers: hdrs });
}
```

- [ ] **Step 2: Write tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { publishToDlq } from '../dlq.handler';

vi.mock('@nats-io/jetstream', () => ({
  jetstream: vi.fn(() => ({
    publish: vi.fn().mockResolvedValue({ stream: 'DLQ', seq: 1 }),
  })),
}));

vi.mock('@nats-io/nats-core', () => ({
  headers: vi.fn(() => {
    const store = new Map<string, string>();
    return { set: (k: string, v: string) => store.set(k, v), get: (k: string) => store.get(k) };
  }),
}));

describe('publishToDlq', () => {
  it('publishes to DLQ.<ORIGIN_STREAM> subject', async () => {
    const { jetstream } = await import('@nats-io/jetstream');
    const mockPublish = vi.fn().mockResolvedValue({ stream: 'DLQ', seq: 1 });
    vi.mocked(jetstream).mockReturnValue({ publish: mockPublish } as never);

    const fakeNc = {} as never;
    await publishToDlq(fakeNc, 'NOTIFICATION.approval.requested', { foo: 'bar' }, 'handler failed', 3, 'corr-1', 'tenant-1');

    expect(mockPublish).toHaveBeenCalledWith(
      'DLQ.NOTIFICATION',
      expect.any(String),
      expect.objectContaining({ headers: expect.anything() }),
    );

    const payload = JSON.parse(mockPublish.mock.calls[0][1] as string);
    expect(payload.originalSubject).toBe('NOTIFICATION.approval.requested');
    expect(payload.error).toBe('handler failed');
    expect(payload.retryCount).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm nx test nats-jetstream`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/nats-jetstream/src/dlq/
git commit -m "feat(nats-jetstream): add DLQ handler"
```

---

## Chunk 2: JetStreamContext + Semaphore + JetStreamServer

### Task 5: JetStreamContext

**Files:**
- Create: `libs/backend/nats-jetstream/src/context/jetstream.context.ts`

- [ ] **Step 1: Write jetstream.context.ts**

```typescript
import { NatsContext } from '@nestjs/microservices';

export interface JetStreamMeta {
  stream: string;
  durableName: string;
  deliveryCount: number;
  sequence: { stream: number; consumer: number };
}

export class JetStreamContext extends NatsContext {
  public signal?: AbortSignal;
  private _nakDelay?: number;
  private readonly meta: JetStreamMeta;

  constructor(args: [string, unknown, JetStreamMeta]) {
    super([args[0], args[1]]);
    this.meta = args[2];
  }

  getStream(): string {
    return this.meta.stream;
  }

  getDurableName(): string {
    return this.meta.durableName;
  }

  getDeliveryCount(): number {
    return this.meta.deliveryCount;
  }

  getSequence(): { stream: number; consumer: number } {
    return this.meta.sequence;
  }

  getCorrelationId(): string {
    const headers = this.getHeaders();
    return headers?.get?.('correlation-id') ?? '';
  }

  getTenantId(): string | undefined {
    const headers = this.getHeaders();
    const value = headers?.get?.('tenant-id');
    return value || undefined;
  }

  setNakDelay(ms: number): void {
    this._nakDelay = ms;
  }

  getNakDelay(): number | undefined {
    return this._nakDelay;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/backend/nats-jetstream/src/context/
git commit -m "feat(nats-jetstream): add JetStreamContext"
```

---

### Task 6: Semaphore utility

**Files:**
- Create: `libs/backend/nats-jetstream/src/server/semaphore.ts`
- Test: `libs/backend/nats-jetstream/src/server/__tests__/semaphore.test.ts`

- [ ] **Step 1: Write semaphore.ts**

```typescript
export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { Semaphore } from '../semaphore';

describe('Semaphore', () => {
  it('allows up to max concurrent acquisitions', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();

    let resolved = false;
    const p = sem.acquire().then(() => { resolved = true; });

    // Third acquire should be blocked
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    sem.release();
    await p;
    expect(resolved).toBe(true);
  });

  it('degrades to sequential for max=1', async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();
    const p1 = sem.acquire().then(() => { order.push(1); sem.release(); });
    const p2 = sem.acquire().then(() => { order.push(2); sem.release(); });

    sem.release();
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm nx test nats-jetstream`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/nats-jetstream/src/server/semaphore.ts libs/backend/nats-jetstream/src/server/__tests__/
git commit -m "feat(nats-jetstream): add Semaphore utility"
```

---

### Task 7: JetStreamServer

This is the core server component. Read `ServerNats` source in `node_modules/@nestjs/microservices/server/server-nats.js` before implementing — you need to understand which methods to override and how `bindEvents()` wires to `handleMessage()`.

**Files:**
- Create: `libs/backend/nats-jetstream/src/server/jetstream.server.ts`
- Create: `libs/backend/nats-jetstream/src/server/errors.ts`

**Key docs to check:**
- Spec: `docs/superpowers/specs/2026-03-17-nats-jetstream-transport-design.md` (sections: Server, Message Lifecycle, Handler Timeout)
- NestJS custom transport: https://docs.nestjs.com/microservices/custom-transport
- `@nats-io/jetstream` consume() API — use Context7 MCP to verify `idle_heartbeat` units (ms vs ns)

- [ ] **Step 1: Write errors.ts**

```typescript
export class HandlerTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Handler timed out after ${timeoutMs}ms`);
    this.name = 'HandlerTimeoutError';
  }
}

export class DeserializationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DeserializationError';
  }
}
```

- [ ] **Step 2: Write jetstream.server.ts**

This is the largest file. Implement by overriding `listen()`, `bindEvents()`, and `close()` from `ServerNats`. The `handleMessage()` override is replaced by `processMessage()` inside `consumeLoop()`.

Key implementation points:
- `listen()`: call `createNatsClient()` (inherited), then `ensureStreams()`, `ensureConsumers()`, `bindEvents()`
- `bindEvents()`: for each `messageHandlers` entry, get the JetStream consumer and start `consumeLoop()`
- `consumeLoop()`: for-await over `consumer.consume()`, acquire semaphore, call `processMessage()`
- `processMessage()`: full lifecycle from spec — deserialize, restore context, execute handler with timeout + AbortSignal, ack/nak/dlq
- `resolveConsumerConfig()`: infer stream (uppercase first segment) and durable (slugify subject) from pattern if not in extras
- `close()`: stop all ConsumerMessages iterators, then `super.close()`

The exact code must be verified against the `@nats-io/jetstream` and `@nestjs/microservices` APIs at implementation time. Use Context7 MCP to look up:
1. `consumer.consume()` options shape (`max_messages`, `idle_heartbeat`, `expires` — confirm units)
2. `msg.info` shape (for `deliveryCount`, `streamSequence`, `consumerSequence`)
3. `msg.nak(delay)` — confirm delay is in milliseconds
4. `jetstreamManager().consumers.add()` options shape

The server must:
- Import `requestContext` from `@roviq/common-types` for context propagation
- Use `publishToDlq()` from `../dlq/dlq.handler.js`
- Use `ensureStreams()` from `../streams/stream.manager.js`
- Use `Semaphore` from `./semaphore.js`
- Use `JetStreamContext` from `../context/jetstream.context.js`
- Use `HandlerTimeoutError`, `DeserializationError` from `./errors.js`

```typescript
import { AckPolicy, jetstream, jetstreamManager } from '@nats-io/jetstream';
import type { ConsumerMessages, JsMsg } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { Logger } from '@nestjs/common';
import { ServerNats } from '@nestjs/microservices/server/server-nats';
import { requestContext, type RequestContext } from '@roviq/common-types';
import { JetStreamContext, type JetStreamMeta } from '../context/jetstream.context.js';
import { publishToDlq } from '../dlq/dlq.handler.js';
import type {
  ConsumerExtras,
  JetStreamServerOptions,
  ResolvedConsumerConfig,
} from '../interfaces/jetstream.options.js';
import { DEFAULT_DLQ_STREAM } from '../streams/stream.config.js';
import { ensureStreams } from '../streams/stream.manager.js';
import { DeserializationError, HandlerTimeoutError } from './errors.js';
import { Semaphore } from './semaphore.js';

// Implementation follows the spec's message lifecycle exactly.
// See docs/superpowers/specs/2026-03-17-nats-jetstream-transport-design.md
```

The full implementation should be ~200-300 lines. The agent implementing this task MUST:
1. Read the `ServerNats` source at `node_modules/@nestjs/microservices/server/server-nats.js`
2. Read the spec's Server section and Message Lifecycle
3. Verify `@nats-io/jetstream` API via Context7 MCP
4. Write the full implementation

- [ ] **Step 3: Verify it compiles**

Run: `pnpm nx build nats-jetstream`
Expected: No compilation errors.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/nats-jetstream/src/server/
git commit -m "feat(nats-jetstream): add JetStreamServer"
```

---

## Chunk 3: JetStreamClient + Barrel Exports

### Task 8: JetStreamClient

**Files:**
- Create: `libs/backend/nats-jetstream/src/client/jetstream.client.ts`

**Key docs to check:**
- Spec: Client section
- `ClientNats` source at `node_modules/@nestjs/microservices/client/client-nats.js`

- [ ] **Step 1: Write jetstream.client.ts**

Key overrides from `ClientNats`:
- `connect()`: call `super.connect()`, store JetStream client reference via `jetstream(this.natsClient)`
- `dispatchEvent(packet)`: serialize packet, publish via `js.publish()` instead of `natsClient.publish()`
- `emit()`: override to return hot Observable via ReplaySubject (auto-subscribe the cold observable from super)
- `mergeHeaders()`: call `super.mergeHeaders()`, then auto-inject `correlation-id`, `tenant-id`, `actor-id`, `impersonator-id` from `requestContext.getStore()`. Warn if context is missing.

```typescript
import { jetstream } from '@nats-io/jetstream';
import type { JetStreamClient as NatsJetStreamClient } from '@nats-io/jetstream';
import { Logger } from '@nestjs/common';
import type { ReadPacket } from '@nestjs/microservices';
import { ClientNats } from '@nestjs/microservices/client/client-nats';
import { requestContext } from '@roviq/common-types';
import { Observable, ReplaySubject } from 'rxjs';

// Implementation follows spec's Client section exactly.
// See docs/superpowers/specs/2026-03-17-nats-jetstream-transport-design.md
```

The agent implementing this task MUST:
1. Read the `ClientNats` source
2. Read the spec's Client section (hot Observable, mergeHeaders, dispatchEvent)
3. Verify `js.publish()` return type and error behavior via Context7

- [ ] **Step 2: Verify it compiles**

Run: `pnpm nx build nats-jetstream`
Expected: No compilation errors.

- [ ] **Step 3: Commit**

```bash
git add libs/backend/nats-jetstream/src/client/
git commit -m "feat(nats-jetstream): add JetStreamClient"
```

---

### Task 9: Barrel exports

**Files:**
- Modify: `libs/backend/nats-jetstream/src/index.ts`

- [ ] **Step 1: Write barrel exports**

```typescript
// Server
export { JetStreamServer } from './server/jetstream.server.js';
export { HandlerTimeoutError, DeserializationError } from './server/errors.js';

// Client
export { JetStreamClient } from './client/jetstream.client.js';

// Context
export { JetStreamContext, type JetStreamMeta } from './context/jetstream.context.js';

// Streams
export { STREAMS, DEFAULT_DLQ_STREAM } from './streams/stream.config.js';
export { ensureStreams } from './streams/stream.manager.js';

// DLQ
export { publishToDlq, type DlqMessage } from './dlq/dlq.handler.js';

// Types
export type {
  JetStreamServerOptions,
  ConsumerExtras,
  ResolvedConsumerConfig,
  StreamConfig,
  DlqOptions,
  PullOptions,
  RetryOptions,
} from './interfaces/jetstream.options.js';
```

- [ ] **Step 2: Verify build**

Run: `pnpm nx build nats-jetstream`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add libs/backend/nats-jetstream/src/index.ts
git commit -m "feat(nats-jetstream): add barrel exports"
```

---

## Chunk 4: Migration — Notification Service

### Task 10: Migrate notification listeners to @EventPattern

**Files:**
- Modify: `apps/notification-service/src/listeners/approval.listener.ts`
- Modify: `apps/notification-service/src/listeners/attendance.listener.ts`
- Modify: `apps/notification-service/src/listeners/fee.listener.ts`
- Modify: `apps/notification-service/src/listeners/auth.listener.ts`
- Modify: `apps/notification-service/src/listeners/subscriber-sync.listener.ts`

Each listener currently:
1. Injects `NATS_CONNECTION`
2. Calls `subscribe()` from `@roviq/nats-utils` in `onModuleInit()`
3. Has handler methods that receive `(payload, meta)`

Each listener must change to:
1. Remove `NATS_CONNECTION` injection
2. Remove `onModuleInit()` with `subscribe()` calls
3. Add `@EventPattern(subject, { stream, durable })` decorators on handler methods
4. Use `@Payload()` and `@Ctx() ctx: JetStreamContext` parameter decorators

- [ ] **Step 1: Migrate approval.listener.ts**

Before:
```typescript
void subscribe<ApprovalRequestedEvent>(this.nc, {
  stream: 'NOTIFICATION',
  subject: NOTIFICATION_SUBJECTS.APPROVAL_REQUESTED,
  durableName: 'notification-approval',
}, (payload, meta) => this.handleRequested(payload, meta));
```

After: Use wildcard pattern since both subjects share the same durable and handler logic is trivially branched:
```typescript
@EventPattern('NOTIFICATION.approval.*', {
  stream: 'NOTIFICATION',
  durable: 'notification-approval',
})
async handle(@Payload() event: ApprovalRequestedEvent | ApprovalResolvedEvent, @Ctx() ctx: JetStreamContext) {
  const subject = ctx.getSubject();
  if (subject.endsWith('.requested')) {
    await this.handleRequested(event as ApprovalRequestedEvent);
  } else if (subject.endsWith('.resolved')) {
    await this.handleResolved(event as ApprovalResolvedEvent);
  }
}
```

Remove: `@Inject(NATS_CONNECTION)`, `implements OnModuleInit`, `onModuleInit()`, `subscribe` import.
Add: `import { Ctx, EventPattern, Payload } from '@nestjs/microservices'`, `import { JetStreamContext } from '@roviq/nats-jetstream'`

- [ ] **Step 2: Migrate attendance.listener.ts**

Single subject — straightforward:
```typescript
@EventPattern(NOTIFICATION_SUBJECTS.ATTENDANCE_ABSENT, {
  stream: 'NOTIFICATION',
  durable: 'notification-attendance',
})
async handle(@Payload() event: AttendanceAbsentEvent, @Ctx() ctx: JetStreamContext) {
  // existing handler logic, no meta param needed
}
```

- [ ] **Step 3: Migrate fee.listener.ts**

Two subjects — use wildcard:
```typescript
@EventPattern('NOTIFICATION.fee.*', {
  stream: 'NOTIFICATION',
  durable: 'notification-fee',
})
async handle(@Payload() event: FeeOverdueEvent | FeeReminderEvent, @Ctx() ctx: JetStreamContext) {
  const subject = ctx.getSubject();
  // dispatch by subject suffix
}
```

- [ ] **Step 4: Migrate auth.listener.ts**

Single subject:
```typescript
@EventPattern(NOTIFICATION_SUBJECTS.AUTH_SECURITY, {
  stream: 'NOTIFICATION',
  durable: 'notification-auth',
})
async handle(@Payload() event: AuthSecurityEvent, @Ctx() ctx: JetStreamContext) {
  // existing handler logic
}
```

- [ ] **Step 5: Migrate subscriber-sync.listener.ts**

Two subjects — use wildcard:
```typescript
@EventPattern('NOTIFICATION.user.*', {
  stream: 'NOTIFICATION',
  durable: 'notification-user-sync',
})
async handle(@Payload() event: UserCreatedEvent | UserUpdatedEvent, @Ctx() ctx: JetStreamContext) {
  // dispatch by subject suffix
}
```

- [ ] **Step 6: Compile check**

Run: `pnpm nx build notification-service`
Expected: May have import errors until main.ts is updated. That's fine — next task.

- [ ] **Step 7: Commit**

```bash
git add apps/notification-service/src/listeners/
git commit -m "refactor(notification-service): migrate listeners to @EventPattern"
```

---

### Task 11: Migrate notification-service main.ts and delete NATS wiring

**Files:**
- Modify: `apps/notification-service/src/main.ts`
- Modify: `apps/notification-service/src/app/app.module.ts`
- Delete: `apps/notification-service/src/nats/nats.provider.ts`
- Delete: `apps/notification-service/src/nats/nats.module.ts`
- Delete: `apps/notification-service/src/nats/ensure-consumers.ts`

- [ ] **Step 1: Update main.ts**

Replace the hybrid `Transport.NATS` + manual JetStream setup with a single `JetStreamServer`:

```typescript
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { JetStreamServer, STREAMS } from '@roviq/nats-jetstream';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    strategy: new JetStreamServer({
      servers: [config.get<string>('NATS_URL', 'nats://localhost:4222')],
      streams: Object.values(STREAMS),
      dlq: { enabled: true },
    }),
  });
  await app.startAllMicroservices();

  const port = config.get<number>('NOTIFICATION_SERVICE_PORT', 3002);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Notification service is running on: http://localhost:${port}`);
}

bootstrap();
```

- [ ] **Step 2: Update app.module.ts**

Remove `NatsModule` import. The listeners module no longer needs it since they use `@EventPattern` decorators registered via the transport.

- [ ] **Step 3: Delete old NATS wiring files**

Delete:
- `apps/notification-service/src/nats/nats.provider.ts`
- `apps/notification-service/src/nats/nats.module.ts`
- `apps/notification-service/src/nats/ensure-consumers.ts`

- [ ] **Step 4: Compile check**

Run: `pnpm nx build notification-service`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/notification-service/
git commit -m "refactor(notification-service): use JetStreamServer transport"
```

---

### Task 12: Migrate billing notification controller

**Files:**
- Modify: `apps/notification-service/src/controllers/billing-notification.controller.ts`

- [ ] **Step 1: Update @EventPattern subjects and imports**

Change:
```typescript
@EventPattern('billing.subscription.*')
@EventPattern('billing.webhook.*')
```

To:
```typescript
@EventPattern('BILLING.subscription.*', {
  stream: 'BILLING',
  durable: 'notification-billing-subscription',
})
@EventPattern('BILLING.webhook.*', {
  stream: 'BILLING',
  durable: 'notification-billing-webhook',
})
```

Update `NatsContext` import to `JetStreamContext` from `@roviq/nats-jetstream`.

Update subject prefix checks in handler:
```typescript
if (subject.startsWith('BILLING.subscription.')) { ... }
else if (subject.startsWith('BILLING.webhook.')) { ... }
```

**Note:** Two `@EventPattern` on the same method with different durable names is not supported by the server. Split into two methods:
```typescript
@EventPattern('BILLING.subscription.*', { stream: 'BILLING', durable: 'notification-billing-subscription' })
async handleSubscription(@Payload() data: SubscriptionEventPayload, @Ctx() ctx: JetStreamContext) {
  await this.handleSubscriptionEvent(ctx.getSubject(), data);
}

@EventPattern('BILLING.webhook.*', { stream: 'BILLING', durable: 'notification-billing-webhook' })
async handleWebhook(@Payload() data: WebhookEventPayload, @Ctx() ctx: JetStreamContext) {
  await this.handleWebhookEvent(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/notification-service/src/controllers/billing-notification.controller.ts
git commit -m "refactor(notification-service): migrate billing controller to JetStream"
```

---

## Chunk 5: Migration — API Gateway + Billing

### Task 13: Register JetStreamClient in api-gateway

**Files:**
- Modify: `apps/api-gateway/src/app.module.ts`

- [ ] **Step 1: Add JetStreamClient provider**

Add a global NATS JetStream client provider that can be injected anywhere in the gateway:

```typescript
import { JetStreamClient } from '@roviq/nats-jetstream';

// In the module's providers array:
{
  provide: 'JETSTREAM_CLIENT',
  useFactory: (config: ConfigService) => {
    const client = new JetStreamClient({
      servers: [config.getOrThrow<string>('NATS_URL')],
    });
    return client;
  },
  inject: [ConfigService],
}
```

Export it so child modules can inject it.

- [ ] **Step 2: Commit**

```bash
git add apps/api-gateway/src/app.module.ts
git commit -m "feat(api-gateway): register JetStreamClient"
```

---

### Task 14: Migrate audit-emitter

**Files:**
- Modify: `libs/backend/audit/src/audit-emitter.ts`
- Modify: `libs/backend/audit/package.json` (update dependency)

- [ ] **Step 1: Update audit-emitter.ts**

Change from raw `NatsConnection` + `publish()` to `JetStreamClient`:

```typescript
import type { ClientProxy } from '@nestjs/microservices';

export interface AuditEvent {
  // ... same interface, unchanged
}

export function emitAuditEvent(client: ClientProxy, event: AuditEvent): void {
  client.emit('AUDIT.log', event);
  // Headers auto-injected by JetStreamClient from AsyncLocalStorage
}
```

- [ ] **Step 2: Update audit/package.json**

Change dependency from `@roviq/nats-utils` to `@roviq/nats-jetstream`:
```json
"dependencies": {
  "@roviq/nats-jetstream": "workspace:*"
}
```

- [ ] **Step 3: Commit**

```bash
git add libs/backend/audit/
git commit -m "refactor(audit): use JetStreamClient for event emission"
```

---

### Task 15: Migrate audit module and consumer

**Files:**
- Modify: `apps/api-gateway/src/audit/audit.module.ts`
- Modify: `apps/api-gateway/src/audit/audit.consumer.ts`
- Modify: `apps/api-gateway/src/audit/audit.interceptor.ts`
- Delete: `apps/api-gateway/src/audit/nats.provider.ts`

- [ ] **Step 1: Update audit.module.ts**

Remove `natsProvider` from providers. The audit consumer needs a raw `NatsConnection` for its batched pull consumer — it will get it from a dedicated provider (not the transport client). Keep a minimal NATS connection provider just for the audit consumer.

Alternatively, the audit interceptor now uses `JetStreamClient` (from `JETSTREAM_CLIENT`) for emitting audit events. The audit consumer stays with its own raw NATS connection for batched consumption.

- [ ] **Step 2: Update audit.interceptor.ts**

Change from `@Inject(NATS_CONNECTION) nc: NatsConnection` + `emitAuditEvent(nc, event, correlationId)` to:
```typescript
@Inject('JETSTREAM_CLIENT') private readonly client: ClientProxy
// ...
emitAuditEvent(this.client, event);
```

- [ ] **Step 3: Update audit.consumer.ts**

Change import of `publishToDlq` from `@roviq/nats-utils` to `@roviq/nats-jetstream`. Everything else stays the same — it's outside the transport.

- [ ] **Step 4: Delete audit nats.provider.ts**

The audit consumer still needs a raw NATS connection. Either keep a minimal provider inline in audit.module.ts or have the consumer create its own connection. The simplest approach is to keep a small inline provider.

- [ ] **Step 5: Compile check**

Run: `pnpm nx build api-gateway`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add apps/api-gateway/src/audit/
git commit -m "refactor(audit): migrate to JetStreamClient for publishing"
```

---

### Task 16: Migrate auth resolver

**Files:**
- Modify: `apps/api-gateway/src/auth/auth.resolver.ts`

- [ ] **Step 1: Update NATS imports and injection**

Change:
```typescript
@Inject(NATS_CONNECTION) private readonly nc: NatsConnection
```
To:
```typescript
@Inject('JETSTREAM_CLIENT') private readonly jetStreamClient: ClientProxy
```

Change publish calls:
```typescript
// Before
void publish(this.nc, NOTIFICATION_SUBJECTS.AUTH_SECURITY, event, { correlationId, tenantId });

// After
this.jetStreamClient.emit(NOTIFICATION_SUBJECTS.AUTH_SECURITY, event);
// Headers auto-injected from AsyncLocalStorage
```

Also update the audit event emission to use the new `emitAuditEvent(this.jetStreamClient, event)`.

- [ ] **Step 2: Commit**

```bash
git add apps/api-gateway/src/auth/auth.resolver.ts
git commit -m "refactor(auth): use JetStreamClient for events"
```

---

### Task 17: Migrate billing module and service

**Files:**
- Modify: `ee/apps/api-gateway/src/billing/billing.module.ts`
- Modify: `ee/apps/api-gateway/src/billing/billing.service.ts`

- [ ] **Step 1: Update billing.module.ts**

Remove `ClientsModule.registerAsync` with `Transport.NATS`. Instead use `JETSTREAM_CLIENT` from the parent module (already registered in app.module.ts). If it's not available in the EE module scope, add a provider:

```typescript
import { JetStreamClient } from '@roviq/nats-jetstream';

@Module({
  imports: [PaymentsModule],
  controllers: [WebhookController],
  providers: [
    BillingRepository,
    BillingService,
    BillingResolver,
    {
      provide: 'BILLING_NATS_CLIENT',
      useFactory: (config: ConfigService) => {
        return new JetStreamClient({
          servers: [config.getOrThrow<string>('NATS_URL')],
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class BillingModule {}
```

- [ ] **Step 2: Update billing.service.ts subject names**

Change all `billing.*` subjects to `BILLING.*`:

```typescript
// billing.plan.created → BILLING.plan.created
// billing.plan.updated → BILLING.plan.updated
// billing.subscription.created → BILLING.subscription.created
// billing.subscription.canceled → BILLING.subscription.canceled
// billing.subscription.paused → BILLING.subscription.paused
// billing.subscription.resumed → BILLING.subscription.resumed
// billing.webhook.${provider} → BILLING.webhook.${provider}
```

The `emitEvent()` method stays the same since `JetStreamClient.emit()` is already hot (auto-subscribes).

- [ ] **Step 3: Compile check**

Run: `pnpm nx build api-gateway`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add ee/apps/api-gateway/src/billing/
git commit -m "refactor(billing): migrate to JetStreamClient"
```

---

## Chunk 6: Cleanup + Circuit Breaker Extraction

### Task 18: Extract circuit breaker to @roviq/resilience

**Files:**
- Create: `libs/backend/resilience/` (scaffold like Task 1)
- Move: `libs/backend/nats-utils/src/circuit-breaker.ts` → `libs/backend/resilience/src/circuit-breaker.ts`
- Move: `libs/backend/nats-utils/src/__tests__/circuit-breaker.test.ts` → `libs/backend/resilience/src/__tests__/circuit-breaker.test.ts`

- [ ] **Step 1: Scaffold @roviq/resilience NX library**

Same pattern as Task 1 but for `@roviq/resilience`. Add path alias to `tsconfig.base.json`.

- [ ] **Step 2: Move circuit breaker files**

Copy `circuit-breaker.ts` and its test. Create `src/index.ts` barrel:
```typescript
export {
  type CircuitBreakerOptions,
  createCircuitBreaker,
  getCircuitBreaker,
  getAllCircuitBreakers,
  removeCircuitBreaker,
  clearAllCircuitBreakers,
} from './circuit-breaker.js';
```

- [ ] **Step 3: Run tests**

Run: `pnpm nx test resilience`
Expected: All circuit breaker tests pass.

- [ ] **Step 4: Commit**

```bash
git add libs/backend/resilience/ tsconfig.base.json
git commit -m "refactor: extract circuit breaker to @roviq/resilience"
```

---

### Task 19: Delete old nats-utils library

**Files:**
- Delete: `libs/backend/nats-utils/` (entire directory)
- Modify: `tsconfig.base.json` (remove `@roviq/nats-utils` path alias)

- [ ] **Step 1: Search for remaining @roviq/nats-utils imports**

Run: `grep -r '@roviq/nats-utils' --include='*.ts' --include='*.json' .`
Expected: Zero results (all migrated in previous tasks).

If any remain, migrate them first.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf libs/backend/nats-utils/
```

- [ ] **Step 3: Remove path alias from tsconfig.base.json**

Remove `"@roviq/nats-utils": ["libs/backend/nats-utils/src/index.ts"]` from paths.

- [ ] **Step 4: Full build check**

Run: `pnpm nx run-many -t build --all`
Expected: All projects build successfully.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete @roviq/nats-utils (replaced by @roviq/nats-jetstream)"
```

---

### Task 20: Lint fix

- [ ] **Step 1: Run lint**

Run: `pnpm lint:fix`
Expected: Clean or only pre-existing issues.

- [ ] **Step 2: Commit if changes**

```bash
git add -A
git commit -m "chore: lint fix after nats-jetstream migration"
```

---

## Chunk 7: Usage Documentation

### Task 21: Write usage documentation

**Files:**
- Create: `docs/nats-jetstream.md`

- [ ] **Step 1: Write docs/nats-jetstream.md**

Cover all sections from spec Section 6:
1. Quick start (minimal server + client setup)
2. Publishing events (`emit()`, explicit headers for out-of-context, `lastValueFrom()` for critical publishes)
3. Consuming events (`@EventPattern` with extras, `JetStreamContext` API, cooperative cancellation via `signal`)
4. Stream & consumer configuration (`STREAMS` constant, auto-creation, inference convention, adding new streams)
5. Error handling (retry with exponential backoff, DLQ flow, safe DLQ failure handling, deserialization errors)
6. Concurrency (`concurrency` option, `handlerTimeout`, semaphore behavior)
7. Audit consumer (why it stays outside, how it imports from `@roviq/nats-jetstream`)
8. Out-of-context publishing (cron, Temporal, `NatsRecordBuilder`)
9. Conventions (stream names uppercase, subject format, `handlerTimeout < ack_wait`, idempotent handlers)
10. Troubleshooting (cold Observable gotcha, missing context, config drift on rolling deploys)

- [ ] **Step 2: Commit**

```bash
git add docs/nats-jetstream.md
git commit -m "docs: add @roviq/nats-jetstream usage guide"
```

---

### Task 22: Runtime verification

- [ ] **Step 1: Start the app**

Run: `pnpm nx serve api-gateway` and `pnpm nx serve notification-service`
Expected: Both start without runtime errors. Check logs for:
- "Stream X ensured" messages from JetStreamServer
- No connection errors
- No missing provider errors

- [ ] **Step 2: Fix any runtime issues iteratively**

If the app fails to start, debug and fix. Common issues:
- Missing providers (JETSTREAM_CLIENT not exported from module)
- Import path issues (`.js` extensions in imports)
- NatsConnection type mismatches
- Consumer config errors (wrong filter_subject)

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(nats-jetstream): runtime fixes after migration"
```
