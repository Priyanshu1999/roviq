import { Inject, Injectable } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { REDIS_CLIENT } from '@roviq/redis';
import type Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private readonly indicator;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.indicator = this.healthIndicatorService.check('redis');
  }

  async isHealthy(): Promise<HealthIndicatorResult<'redis'>> {
    try {
      await this.redis.ping();
      return this.indicator.up();
    } catch {
      return this.indicator.down();
    }
  }
}
