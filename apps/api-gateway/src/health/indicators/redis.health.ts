import { Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private readonly indicator;

  constructor(private readonly healthIndicatorService: HealthIndicatorService) {
    this.indicator = this.healthIndicatorService.check('redis');
  }

  async isHealthy(): Promise<HealthIndicatorResult<'redis'>> {
    try {
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      return this.indicator.up();
    } catch {
      return this.indicator.down();
    }
  }
}
