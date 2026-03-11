import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mocks
const { mockPublishToDlq } = vi.hoisted(() => ({
  mockPublishToDlq: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@roviq/nats-utils', () => ({
  publishToDlq: mockPublishToDlq,
}));

vi.mock('@nats-io/jetstream', () => ({
  AckPolicy: { Explicit: 'explicit' },
  jetstream: vi.fn(),
  jetstreamManager: vi.fn(),
}));

import { jetstream, jetstreamManager } from '@nats-io/jetstream';
import { AuditConsumer } from '../audit.consumer';

const mockJetstream = vi.mocked(jetstream);
const mockJetstreamManager = vi.mocked(jetstreamManager);

function createAuditEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    actorId: 'user-1',
    action: 'createUser',
    actionType: 'CREATE',
    entityType: 'User',
    entityId: 'entity-1',
    changes: null,
    metadata: { args: {} },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    source: 'GATEWAY',
    ...overrides,
  };
}

function createMockMessage(
  event: Record<string, unknown>,
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
  const msg = createMockMessage({}, opts);
  msg.json = () => {
    throw new SyntaxError('Unexpected token');
  };
  return msg;
}

function createMockPool() {
  return {
    query: vi.fn().mockResolvedValue({ rowCount: 1 }),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

/** Creates an async iterable that yields given messages, then hangs (simulating waiting for more) */
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
          // Hang indefinitely — simulates waiting for new messages
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

  it('should batch insert events and ack after successful write', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();

    // Allow the consume loop to process the message
    await vi.advanceTimersByTimeAsync(0);

    // Trigger flush via timer
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    const [queryText, values] = mockPool.query.mock.calls[0];
    expect(queryText).toContain('INSERT INTO audit_logs');
    expect(queryText).toContain('$1');
    expect(queryText).toContain('ON CONFLICT');
    expect(values).toBeInstanceOf(Array);
    expect(values).toHaveLength(14); // 14 columns per row
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('should use parameterized queries, not string interpolation', async () => {
    const event = createAuditEvent({ entityType: "Robert'; DROP TABLE audit_logs;--" });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    const [queryText, values] = mockPool.query.mock.calls[0];
    // Query uses placeholders, not interpolated values
    expect(queryText).toContain('$1');
    expect(queryText).not.toContain('Robert');
    // SQL injection payload is safely in values array
    expect(values).toContain("Robert'; DROP TABLE audit_logs;--");
  });

  it('should term() malformed JSON without retry', async () => {
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

  it('should nak messages when batch insert fails (under max retries)', async () => {
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

  it('should call publishToDlq and term after max retries', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event, { deliveryCount: 3 }); // MAX_RETRIES = 3
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

  it('should flush on interval even if batch is not full', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    // No flush yet — batch not full and timer hasn't fired
    expect(mockPool.query).not.toHaveBeenCalled();

    // Advance past FLUSH_INTERVAL_MS (500ms)
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('should handle multiple messages in a single batch', async () => {
    const messages = Array.from({ length: 3 }, (_, i) =>
      createMockMessage(createAuditEvent({ entityId: `entity-${i}` }), {
        correlationId: `corr-${i}`,
      }),
    );
    const stream = createMessageStream(messages);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();

    // Process all messages
    for (let i = 0; i < messages.length; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    const [, values] = mockPool.query.mock.calls[0];
    // 3 messages × 14 columns
    expect(values).toHaveLength(42);
    for (const msg of messages) {
      expect(msg.ack).toHaveBeenCalledOnce();
    }
  });

  it('should create consumer if it does not exist', async () => {
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

  it('should cleanup on module destroy', async () => {
    const stream = createMessageStream([]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    // Allow fire-and-forget startConsuming() to assign consumerMessages
    await vi.advanceTimersByTimeAsync(0);
    await consumer.onModuleDestroy();

    expect(stream.close).toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it('should handle null optional fields in events', async () => {
    const event = createAuditEvent({
      impersonatorId: undefined,
      entityId: undefined,
      changes: null,
      metadata: null,
      ipAddress: undefined,
      userAgent: undefined,
    });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockPool as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(mockPool.query).toHaveBeenCalledOnce();
    const values = mockPool.query.mock.calls[0][1];
    // impersonatorId, entityId, changes, metadata, ipAddress, userAgent should be null
    expect(values[3]).toBeNull(); // impersonatorId
    expect(values[7]).toBeNull(); // entityId
    expect(values[8]).toBeNull(); // changes
    expect(values[9]).toBeNull(); // metadata
    expect(values[11]).toBeNull(); // ipAddress
    expect(values[12]).toBeNull(); // userAgent
    expect(msg.ack).toHaveBeenCalled();
  });
});
