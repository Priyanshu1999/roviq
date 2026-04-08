import { HealthCheckService } from '@nestjs/terminus';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from '../health.controller';
import { RedisHealthIndicator } from '../indicators/redis.health';

function createMockHealthCheckService() {
  return createMock<HealthCheckService>({
    check: vi.fn().mockImplementation(async (indicators: (() => Promise<unknown>)[]) => {
      const results = await Promise.all(indicators.map((fn) => fn()));
      const info = Object.assign({}, ...results);
      return { status: 'ok', info, details: info, error: {} };
    }),
  });
}

function createMockRedisIndicator() {
  return createMock<RedisHealthIndicator>({
    isHealthy: vi.fn().mockResolvedValue({ redis: { status: 'up' } }),
  });
}

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealth: ReturnType<typeof createMockHealthCheckService>;
  let mockRedis: ReturnType<typeof createMockRedisIndicator>;

  beforeEach(() => {
    mockHealth = createMockHealthCheckService();
    mockRedis = createMockRedisIndicator();

    controller = new HealthController(mockHealth, mockRedis);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.info).toEqual({ redis: { status: 'up' } });
  });

  it('should call redis health indicator', async () => {
    await controller.check();
    expect(mockRedis.isHealthy).toHaveBeenCalled();
  });

  it('should call health check service with indicator functions', async () => {
    await controller.check();
    expect(mockHealth.check).toHaveBeenCalledWith([expect.any(Function)]);
  });
});
