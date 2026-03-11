import type { NatsConnection } from '@nats-io/nats-core';
import { describe, expect, it, vi } from 'vitest';
import { ensureStreams, STREAMS } from '../streams';

describe('STREAMS', () => {
  it('should define INSTITUTE stream', () => {
    expect(STREAMS.INSTITUTE).toEqual({
      name: 'INSTITUTE',
      subjects: ['INSTITUTE.>'],
      retention: 'workqueue',
      storage: 'file',
      maxDeliver: 3,
    });
  });

  it('should define ADMIN stream', () => {
    expect(STREAMS.ADMIN).toEqual({
      name: 'ADMIN',
      subjects: ['ADMIN.>'],
      retention: 'workqueue',
      storage: 'file',
      maxDeliver: 3,
    });
  });

  it('should define NOTIFICATION stream with higher maxDeliver', () => {
    expect(STREAMS.NOTIFICATION).toEqual({
      name: 'NOTIFICATION',
      subjects: ['NOTIFICATION.>'],
      retention: 'workqueue',
      storage: 'file',
      maxDeliver: 5,
    });
  });

  it('should define AUDIT stream with limits retention', () => {
    expect(STREAMS.AUDIT).toEqual({
      name: 'AUDIT',
      subjects: ['AUDIT.>'],
      retention: 'limits',
      storage: 'file',
      maxDeliver: 5,
    });
  });

  it('should define DLQ stream with limits retention', () => {
    expect(STREAMS.DLQ).toEqual({
      name: 'DLQ',
      subjects: ['DLQ.>'],
      retention: 'limits',
      storage: 'file',
      maxDeliver: 1,
    });
  });

  it('all streams should use file storage', () => {
    for (const stream of Object.values(STREAMS)) {
      expect(stream.storage).toBe('file');
    }
  });
});

describe('ensureStreams', () => {
  interface MockStreamConfig {
    name: string;
    subjects: string[];
    retention: unknown;
    storage: unknown;
  }

  function createMockStreamsApi(existingStreams: string[], addedStreams: MockStreamConfig[]) {
    const info = vi.fn();
    info.mockImplementation(async (name: string) => {
      if (!existingStreams.includes(name)) throw new Error('stream not found');
      return { config: { name } };
    });

    const add = vi.fn();
    add.mockImplementation(async (config: MockStreamConfig) => {
      addedStreams.push(config);
      return config;
    });

    return {
      info,
      add,
      update: vi.fn(),
      purge: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      deleteMessage: vi.fn(),
      getMessage: vi.fn(),
      find: vi.fn(),
      names: vi.fn(),
      get: vi.fn(),
    };
  }

  function createMockNc(existingStreams: string[] = []) {
    const addedStreams: MockStreamConfig[] = [];
    const streamsApi = createMockStreamsApi(existingStreams, addedStreams);
    const mockJsm = { streams: streamsApi };
    return { nc: {} as NatsConnection, mockJsm, addedStreams, streamsApi };
  }

  it('should create all streams when none exist', async () => {
    const { nc, mockJsm, addedStreams } = createMockNc([]);

    await import('../streams.js');
    const jsmModule = await import('@nats-io/jetstream');
    vi.spyOn(jsmModule, 'jetstreamManager');
    vi.mocked(jsmModule.jetstreamManager, { partial: true }).mockResolvedValue(mockJsm);

    await ensureStreams(nc);

    expect(addedStreams).toHaveLength(Object.keys(STREAMS).length);
    const addedNames = addedStreams.map((s) => s.name);
    expect(addedNames).toContain('INSTITUTE');
    expect(addedNames).toContain('ADMIN');
    expect(addedNames).toContain('NOTIFICATION');
    expect(addedNames).toContain('AUDIT');
    expect(addedNames).toContain('DLQ');

    vi.restoreAllMocks();
  });

  it('should skip existing streams (idempotent)', async () => {
    const { nc, mockJsm, addedStreams, streamsApi } = createMockNc([
      'INSTITUTE',
      'ADMIN',
      'NOTIFICATION',
      'AUDIT',
      'DLQ',
    ]);

    const jsmModule = await import('@nats-io/jetstream');
    vi.spyOn(jsmModule, 'jetstreamManager');
    vi.mocked(jsmModule.jetstreamManager, { partial: true }).mockResolvedValue(mockJsm);

    await ensureStreams(nc);

    expect(addedStreams).toHaveLength(0);
    expect(streamsApi.info).toHaveBeenCalledTimes(Object.keys(STREAMS).length);

    vi.restoreAllMocks();
  });

  it('should only create missing streams', async () => {
    const { nc, mockJsm, addedStreams } = createMockNc(['INSTITUTE', 'ADMIN']);

    const jsmModule = await import('@nats-io/jetstream');
    vi.spyOn(jsmModule, 'jetstreamManager');
    vi.mocked(jsmModule.jetstreamManager, { partial: true }).mockResolvedValue(mockJsm);

    await ensureStreams(nc);

    expect(addedStreams).toHaveLength(3);
    const addedNames = addedStreams.map((s) => s.name);
    expect(addedNames).toContain('NOTIFICATION');
    expect(addedNames).toContain('AUDIT');
    expect(addedNames).toContain('DLQ');

    vi.restoreAllMocks();
  });
});
