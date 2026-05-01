import { Test, type TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from '@roviq/redis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WsTicketController } from '../ws-ticket.controller';

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn(),
  };
}

describe('WsTicketController', () => {
  let controller: WsTicketController;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    mockRedis = createMockRedis();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WsTicketController],
      providers: [{ provide: REDIS_CLIENT, useValue: mockRedis }],
    }).compile();

    controller = module.get<WsTicketController>(WsTicketController);
  });

  describe('getWsTicket', () => {
    it('should return a ticket and store user data in Redis with 30s TTL', async () => {
      const user = {
        _scope: 'institute' as const,
        userId: 'user-1',
        scope: 'institute' as const,
        tenantId: 'tenant-1',
        roleId: 'role-1',
        membershipId: 'membership-1',
        type: 'access' as const,
      };

      const result = await controller.getWsTicket({ user });

      expect(result.ticket).toBeDefined();
      expect(typeof result.ticket).toBe('string');
      // UUID v4 format
      expect(result.ticket).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        `ws-ticket:${result.ticket}`,
        JSON.stringify({
          userId: 'user-1',
          scope: 'institute',
          tenantId: 'tenant-1',
          resellerId: null,
          roleId: 'role-1',
          membershipId: 'membership-1',
        }),
        'EX',
        30,
      );
    });

    it('should generate unique tickets per call', async () => {
      const user = {
        _scope: 'platform' as const,
        userId: 'user-1',
        scope: 'platform' as const,
        roleId: 'role-1',
        membershipId: 'membership-1',
        type: 'access' as const,
      };

      const result1 = await controller.getWsTicket({ user });
      const result2 = await controller.getWsTicket({ user });

      expect(result1.ticket).not.toBe(result2.ticket);
    });
  });
});
