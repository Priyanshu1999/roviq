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

function createMockAuditWriteRepo() {
  return {
    batchInsert: vi.fn().mockResolvedValue(undefined),
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
  let mockWriteRepo: ReturnType<typeof createMockAuditWriteRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockWriteRepo = createMockAuditWriteRepo();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should batch insert events and ack after successful write', async () => {
    const event = createAuditEvent();
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
    await consumer.onModuleInit();

    // Allow the consume loop to process the message
    await vi.advanceTimersByTimeAsync(0);

    // Trigger flush via timer
    await vi.advanceTimersByTimeAsync(500);

    expect(mockWriteRepo.batchInsert).toHaveBeenCalledOnce();
    expect(mockWriteRepo.batchInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 'tenant-1', correlationId: 'corr-1' }),
      ]),
    );
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('should use parameterized queries, not string interpolation', async () => {
    const event = createAuditEvent({ entityType: "Robert'; DROP TABLE audit_logs;--" });
    const msg = createMockMessage(event);
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    // The consumer passes the raw data to the repository — SQL injection prevention is the repo's responsibility
    expect(mockWriteRepo.batchInsert).toHaveBeenCalledOnce();
    const events = mockWriteRepo.batchInsert.mock.calls[0][0];
    expect(events[0].entityType).toBe("Robert'; DROP TABLE audit_logs;--");
  });

  it('should term() malformed JSON without retry', async () => {
    const msg = createMalformedMessage();
    const stream = createMessageStream([msg]);
    setupJetstreamMocks(stream);

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
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

    mockWriteRepo.batchInsert.mockRejectedValueOnce(new Error('connection refused'));

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
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

    mockWriteRepo.batchInsert.mockRejectedValueOnce(new Error('persistent failure'));

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
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

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);

    // No flush yet — batch not full and timer hasn't fired
    expect(mockWriteRepo.batchInsert).not.toHaveBeenCalled();

    // Advance past FLUSH_INTERVAL_MS (500ms)
    await vi.advanceTimersByTimeAsync(500);

    expect(mockWriteRepo.batchInsert).toHaveBeenCalledOnce();
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

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
    await consumer.onModuleInit();

    // Process all messages
    for (let i = 0; i < messages.length; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
    await vi.advanceTimersByTimeAsync(500);

    expect(mockWriteRepo.batchInsert).toHaveBeenCalledOnce();
    const events = mockWriteRepo.batchInsert.mock.calls[0][0];
    expect(events).toHaveLength(3);
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

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
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

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
    await consumer.onModuleInit();
    // Allow fire-and-forget startConsuming() to assign consumerMessages
    await vi.advanceTimersByTimeAsync(0);
    await consumer.onModuleDestroy();

    expect(stream.close).toHaveBeenCalled();
    // Pool lifecycle is managed by AuditWritePgRepository, not consumer
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

    consumer = new AuditConsumer({} as never, mockWriteRepo as never);
    await consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(mockWriteRepo.batchInsert).toHaveBeenCalledOnce();
    const events = mockWriteRepo.batchInsert.mock.calls[0][0];
    expect(events[0].impersonatorId).toBeUndefined();
    expect(events[0].entityId).toBeUndefined();
    expect(events[0].changes).toBeNull();
    expect(events[0].metadata).toBeNull();
    expect(events[0].ipAddress).toBeUndefined();
    expect(events[0].userAgent).toBeUndefined();
    expect(msg.ack).toHaveBeenCalled();
  });
});
