import type { JetStreamClient } from '@nats-io/jetstream';
import type { MsgHdrs } from '@nats-io/nats-core';
import { createMock } from '@roviq/testing';
import { describe, expect, it, vi } from 'vitest';
import { publishToDlq } from '../dlq.handler';

vi.mock('@nats-io/nats-core', () => ({
  headers: vi.fn(() => {
    const store = new Map<string, string>();
    return {
      set: (k: string, v: string) => store.set(k, v),
      get: (k: string) => store.get(k),
    };
  }),
}));

describe('publishToDlq', () => {
  it('derives DLQ subject from first segment of original subject (uppercase)', async () => {
    const mockPublish = vi.fn().mockResolvedValue({ stream: 'DLQ', seq: 1 });
    const fakeJs = createMock<JetStreamClient>({ publish: mockPublish });

    await publishToDlq(
      fakeJs,
      'NOTIFICATION.approval.requested',
      { foo: 'bar' },
      'handler failed',
      3,
      'corr-1',
      'tenant-1',
    );

    expect(mockPublish).toHaveBeenCalledWith(
      'DLQ.NOTIFICATION',
      expect.any(String),
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it('uses uppercase first segment even for lowercase subjects', async () => {
    const mockPublish = vi.fn().mockResolvedValue({ stream: 'DLQ', seq: 1 });
    const fakeJs = createMock<JetStreamClient>({ publish: mockPublish });

    await publishToDlq(fakeJs, 'audit.log', { event: 'test' }, 'error msg', 1, 'corr-2');

    expect(mockPublish).toHaveBeenCalledWith('DLQ.AUDIT', expect.any(String), expect.anything());
  });

  it('includes correct payload structure', async () => {
    const mockPublish = vi.fn().mockResolvedValue({ stream: 'DLQ', seq: 1 });
    const fakeJs = createMock<JetStreamClient>({ publish: mockPublish });

    await publishToDlq(
      fakeJs,
      'INSTITUTE.member.updated',
      { memberId: '123' },
      'processing error',
      2,
      'corr-3',
      'tenant-abc',
    );

    const rawPayload = mockPublish.mock.calls[0]?.[1] as string;
    const payload = JSON.parse(rawPayload);

    expect(payload.originalSubject).toBe('INSTITUTE.member.updated');
    expect(payload.error).toBe('processing error');
    expect(payload.retryCount).toBe(2);
    expect(payload.correlationId).toBe('corr-3');
    expect(payload.tenantId).toBe('tenant-abc');
    expect(payload.failedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not include tenantId header when tenantId is undefined', async () => {
    const mockPublish = vi.fn().mockResolvedValue({ stream: 'DLQ', seq: 1 });
    const fakeJs = createMock<JetStreamClient>({ publish: mockPublish });

    const { headers } = await import('@nats-io/nats-core');
    const mockHdrs = createMock<MsgHdrs>({ set: vi.fn(), get: vi.fn() });
    vi.mocked(headers).mockReturnValueOnce(mockHdrs);

    await publishToDlq(fakeJs, 'BILLING.subscription.canceled', { sub: 'x' }, 'error', 1, 'corr-4');

    expect(mockHdrs.set).not.toHaveBeenCalledWith('tenant-id', expect.anything());
    expect(mockHdrs.set).toHaveBeenCalledWith('correlation-id', 'corr-4');
    expect(mockHdrs.set).toHaveBeenCalledWith('dlq-reason', 'error');
  });
});
