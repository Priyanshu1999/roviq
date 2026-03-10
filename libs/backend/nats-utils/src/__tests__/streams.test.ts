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

  it('should define DLQ stream with limits retention', () => {
    expect(STREAMS.DLQ).toEqual({
      name: 'DLQ',
      subjects: ['*.DLQ', '*.*.DLQ'],
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
  function createMockNc(existingStreams: string[] = []) {
    const addedStreams: any[] = [];
    const mockJsm = {
      streams: {
        info: vi.fn(async (name: string) => {
          if (!existingStreams.includes(name)) throw new Error('stream not found');
          return { config: { name } };
        }),
        add: vi.fn(async (config: any) => {
          addedStreams.push(config);
          return config;
        }),
      },
    };
    return { nc: {} as any, mockJsm, addedStreams };
  }

  it('should create all streams when none exist', async () => {
    const { nc, mockJsm, addedStreams } = createMockNc([]);

    // Mock jetstreamManager to return our mock
    await import('../streams.js');
    const jsmModule = await import('@nats-io/jetstream');
    vi.spyOn(jsmModule, 'jetstreamManager').mockResolvedValue(mockJsm as any);

    await ensureStreams(nc);

    expect(addedStreams).toHaveLength(Object.keys(STREAMS).length);
    const addedNames = addedStreams.map((s) => s.name);
    expect(addedNames).toContain('INSTITUTE');
    expect(addedNames).toContain('ADMIN');
    expect(addedNames).toContain('NOTIFICATION');
    expect(addedNames).toContain('DLQ');

    vi.restoreAllMocks();
  });

  it('should skip existing streams (idempotent)', async () => {
    const { nc, mockJsm, addedStreams } = createMockNc([
      'INSTITUTE',
      'ADMIN',
      'NOTIFICATION',
      'DLQ',
    ]);

    const jsmModule = await import('@nats-io/jetstream');
    vi.spyOn(jsmModule, 'jetstreamManager').mockResolvedValue(mockJsm as any);

    await ensureStreams(nc);

    expect(addedStreams).toHaveLength(0);
    expect(mockJsm.streams.info).toHaveBeenCalledTimes(Object.keys(STREAMS).length);

    vi.restoreAllMocks();
  });

  it('should only create missing streams', async () => {
    const { nc, mockJsm, addedStreams } = createMockNc(['INSTITUTE', 'ADMIN']);

    const jsmModule = await import('@nats-io/jetstream');
    vi.spyOn(jsmModule, 'jetstreamManager').mockResolvedValue(mockJsm as any);

    await ensureStreams(nc);

    expect(addedStreams).toHaveLength(2);
    const addedNames = addedStreams.map((s) => s.name);
    expect(addedNames).toContain('NOTIFICATION');
    expect(addedNames).toContain('DLQ');

    vi.restoreAllMocks();
  });
});
