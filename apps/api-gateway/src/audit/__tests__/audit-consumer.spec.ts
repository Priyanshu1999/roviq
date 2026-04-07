import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mocks
const { mockPublishToDlq } = vi.hoisted(() => ({
  mockPublishToDlq: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@roviq/nats-jetstream', () => ({
  publishToDlq: mockPublishToDlq,
}));

vi.mock('@nats-io/jetstream', () => ({
  AckPolicy: { Explicit: 'explicit' },
  jetstream: vi.fn(),
  jetstreamManager: vi.fn(),
}));

import { jetstream, jetstreamManager } from '@nats-io/jetstream';
import type { AuditEvent } from '../audit.consumer';
import { AuditConsumer } from '../audit.consumer';

const mockJetstream = vi.mocked(jetstream);
const mockJetstreamManager = vi.mocked(jetstreamManager);

function createAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    scope: 'institute',
    tenantId: 'tenant-1',
    resellerId: null,
    userId: 'user-1',
    actorId: 'user-1',
    impersonatorId: null,
    impersonationSessionId: null,
    action: 'createStudent',
    actionType: 'CREATE',
    entityType: 'Student',
    entityId: 'entity-1',
    changes: null,
    metadata: { input: {} },
    correlationId: 'corr-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    source: 'GATEWAY',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockMessage(
  event: AuditEvent,
  opts: {
    deliveryCount?: number;
    subject?: string;
    correlationId?: string;
    tenantId?: string;
  } = {},
) {
  const {
    deliveryCount = 1,
    subject = 'AUDIT.log',
    correlationId = 'corr-1',
    tenantId = 'tenant-1',
  } = opts;
  return {
    json: () => event,
    headers: {
      get: (key: string) => {
        if (key === 'correlation-id') return correlationId;
        if (key === 'tenant-id') return tenantId;
        return '';
      },
    },
    info: { deliveryCount },
    subject,
    ack: vi.fn(),
    nak: vi.fn(),
    term: vi.fn(),
  };
}

function createMalformedMessage(
  opts: { deliveryCount?: number; correlationId?: string; tenantId?: string } = {},
) {
  const msg = createMockMessage(createAuditEvent(), opts);
  msg.json = () => {
    throw new SyntaxError('Unexpected token');
  };
  return msg;
}

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

function createMessageStream(messages: ReturnType<typeof createMockMessage>[]) {
  let index = 0;
  return {
    close: vi.fn(),
    [Symbol.asyncIterator]() {
      return {
        next: () => {
          if (index < messages.length) {
            return Promise.resolve({ value: messages[index++], done: false });
          }
          return new Promise(() => {});
        },
      };
    },
  };
}

function setupJetstreamMocks(messageStream: ReturnType<typeof createMessageStream>) {
  mockJetstreamManager.mockResolvedValue({
    consumers: {
      info: vi.fn().mockResolvedValue({}),
      add: vi.fn().mockResolvedValue({}),
    },
  } as never);

  mockJetstream.mockReturnValue({
    consumers: {
      get: vi.fn().mockResolvedValue({
        consume: vi.fn().mockResolvedValue(messageStream),
      }),
    },
  } as never);
}

describe('AuditConsumer', () => {
  let consumer: AuditConsumer;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPool = createMockPool();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches events and acks after successful raw SQL write', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    // Verify parameterized query with $N placeholders
    const [sql, values] = mockPool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(sql).toContain('ON CONFLICT (id, created_at) DO NOTHING');
    expect(sql).toContain('$1');
    expect(sql).not.toContain("'tenant-1'"); // no string interpolation
    expect(values).toBeInstanceOf(Array);
    expect(values.length).toBe(19); // 19 columns
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('uses parameterized queries, not string interpolation', async () => {
    const event = createAuditEvent({
      entityType: "Robert'; DROP TABLE audit_logs;--",
    });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    const [sql, values] = mockPool.query.mock.calls[0];
    // SQL injection string must be in values array, NOT in SQL string
    expect(sql).not.toContain('DROP TABLE');
    expect(values).toContain("Robert'; DROP TABLE audit_logs;--");
  });

  it('includes all 19 columns matching audit_logs schema', async () => {
    const event = createAuditEvent({
      scope: 'reseller',
      resellerId: 'reseller-1',
      tenantId: null,
      impersonatorId: 'admin-1',
      impersonationSessionId: 'session-1',
    });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    const [sql, values] = mockPool.query.mock.calls[0];
    // Verify all columns present in INSERT
    for (const col of [
      'scope',
      'tenant_id',
      'reseller_id',
      'impersonator_id',
      'impersonation_session_id',
      'correlation_id',
    ]) {
      expect(sql).toContain(col);
    }
    // Verify values include scope-specific fields
    expect(values).toContain('reseller');
    expect(values).toContain('reseller-1');
    expect(values).toContain('admin-1');
    expect(values).toContain('session-1');
  });

  it('term() malformed JSON without retry, publishes to DLQ', async () => {
    const msg = createMalformedMessage();
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    expect(msg.term).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.nak).not.toHaveBeenCalled();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.anything(),
      'AUDIT.log',
      null,
      'Malformed JSON payload',
      expect.any(Number),
      expect.any(String),
      expect.any(String),
    );
  });

  it('nak messages on transient failure (under max retries)', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event, { deliveryCount: 1 });
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    mockPool.query.mockRejectedValueOnce(new Error('connection refused'));

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(msg.nak).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it('publishes to DLQ and term after max retries', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event, { deliveryCount: 3 });
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    mockPool.query.mockRejectedValueOnce(new Error('persistent failure'));

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(msg.term).toHaveBeenCalledOnce();
    expect(mockPublishToDlq).toHaveBeenCalledWith(
      expect.anything(),
      'AUDIT.log',
      event,
      'persistent failure',
      3,
      'corr-1',
      'tenant-1',
    );
  });

  it('flushes on interval even if batch is not full', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockPool.query).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('handles multiple messages in a single batch', async () => {
    const messages = Array.from({ length: 3 }, (_, i) =>
      createMockMessage(createAuditEvent({ entityId: `entity-${i}` }), {
        correlationId: `corr-${i}`,
      }),
    );
    const stream = createMessageStream(messages);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();

    for (let i = 0; i < messages.length; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    // 3 events × 19 columns = 57 values
    const [, values] = mockPool.query.mock.calls[0];
    expect(values.length).toBe(57);
    for (const msg of messages) {
      expect(msg.ack).toHaveBeenCalledOnce();
    }
  });

  it('creates consumer if it does not exist', async () => {
    const stream = createMessageStream([]);
    const mockAdd = vi.fn().mockResolvedValue({});
    mockJetstreamManager.mockResolvedValue({
      consumers: {
        info: vi.fn().mockRejectedValue(new Error('not found')),
        add: mockAdd,
      },
    } as never);
    mockJetstream.mockReturnValue({
      consumers: {
        get: vi.fn().mockResolvedValue({
          consume: vi.fn().mockResolvedValue(stream),
        }),
      },
    } as never);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();

    expect(mockAdd).toHaveBeenCalledWith(
      'AUDIT',
      expect.objectContaining({
        durable_name: 'audit-log-writer',
        filter_subject: 'AUDIT.log',
      }),
    );
  });

  it('cleans up on module destroy (flushes buffer, closes pool)', async () => {
    const stream = createMessageStream([]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await consumer.onModuleDestroy();

    expect(stream.close).toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalledOnce();
  });

  it('serializes JSONB fields (changes, metadata) as JSON strings', async () => {
    const event = createAuditEvent({
      changes: { name: { old: 'A', new: 'B' } },
      metadata: { affected_count: 5 },
    });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    const [, values] = mockPool.query.mock.calls[0];
    // changes and metadata should be JSON strings, not objects
    const changesIdx = values.findIndex(
      (v: unknown) => typeof v === 'string' && v.includes('"old"'),
    );
    expect(changesIdx).toBeGreaterThan(-1);
    expect(JSON.parse(values[changesIdx])).toEqual({
      name: { old: 'A', new: 'B' },
    });
  });

  it('passes null for null JSONB fields', async () => {
    const event = createAuditEvent({ changes: null, metadata: null });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    const [, values] = mockPool.query.mock.calls[0];
    // columns[12] = changes, columns[13] = metadata → both null
    expect(values[12]).toBeNull();
    expect(values[13]).toBeNull();
  });
});
