import type { ConfigService } from '@nestjs/config';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribersCreate = vi.fn().mockResolvedValue(undefined);
const mockNovuInstance = { subscribers: { create: mockSubscribersCreate } };

vi.mock('@roviq/notifications', async (importOriginal) => {
  const original = await importOriginal<typeof import('@roviq/notifications')>();
  return { ...original, createNovuClient: vi.fn(() => mockNovuInstance) };
});

import type { SubscriberData } from '@roviq/notifications';
import { SubscriberSyncService } from '../subscriber-sync.service';

function makeConfigService() {
  return createMock<ConfigService>({
    get: vi.fn().mockReturnValue('cloud'),
    getOrThrow: vi.fn().mockReturnValue('novu-secret'),
  });
}

function makeSubscriberData(overrides: Partial<SubscriberData> = {}): SubscriberData {
  return {
    subscriberId: 'user-abc-123',
    email: 'riya@example.com',
    phone: '+911234567890',
    firstName: 'Riya',
    lastName: 'Sharma',
    data: { instituteId: 'tenant-1' },
    ...overrides,
  };
}

describe('SubscriberSyncService', () => {
  let service: SubscriberSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubscriberSyncService(makeConfigService());
  });

  describe('syncSubscriber', () => {
    it('calls novu.subscribers.create with the correct subscriber data', async () => {
      const data = makeSubscriberData();

      await service.syncSubscriber(data);

      expect(mockSubscribersCreate).toHaveBeenCalledOnce();
      expect(mockSubscribersCreate).toHaveBeenCalledWith({
        subscriberId: 'user-abc-123',
        email: 'riya@example.com',
        phone: '+911234567890',
        firstName: 'Riya',
        lastName: 'Sharma',
        data: { instituteId: 'tenant-1' },
      });
    });

    it('uses the plain userId as subscriberId (no tenant prefix)', async () => {
      const data = makeSubscriberData({ subscriberId: 'plain-user-id' });

      await service.syncSubscriber(data);

      expect(mockSubscribersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ subscriberId: 'plain-user-id' }),
      );
      const callArg = mockSubscribersCreate.mock.calls[0][0] as { subscriberId: string };
      expect(callArg.subscriberId).not.toContain(':');
    });

    it('forwards optional fields when provided', async () => {
      const data = makeSubscriberData({
        email: 'test@roviq.io',
        phone: '+10000000000',
        firstName: 'Test',
        lastName: 'User',
        data: { role: 'STUDENT' },
      });

      await service.syncSubscriber(data);

      expect(mockSubscribersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@roviq.io',
          phone: '+10000000000',
          firstName: 'Test',
          lastName: 'User',
          data: { role: 'STUDENT' },
        }),
      );
    });

    it('passes undefined optional fields through when not provided', async () => {
      const data: SubscriberData = { subscriberId: 'minimal-user' };

      await service.syncSubscriber(data);

      expect(mockSubscribersCreate).toHaveBeenCalledWith({
        subscriberId: 'minimal-user',
        email: undefined,
        phone: undefined,
        firstName: undefined,
        lastName: undefined,
        data: undefined,
      });
    });

    it('resolves without throwing on successful Novu call', async () => {
      const data = makeSubscriberData();

      await expect(service.syncSubscriber(data)).resolves.toBeUndefined();
    });

    it('propagates errors thrown by novu.subscribers.create', async () => {
      mockSubscribersCreate.mockRejectedValueOnce(new Error('Novu API error'));
      const data = makeSubscriberData();

      await expect(service.syncSubscriber(data)).rejects.toThrow('Novu API error');
    });
  });
});
