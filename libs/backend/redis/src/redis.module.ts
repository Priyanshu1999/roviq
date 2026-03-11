import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT } from './redis.constants';

const logger = new Logger('RedisModule');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const client = new Redis(config.getOrThrow<string>('REDIS_URL'));
        client.on('error', (err) => {
          logger.error('Redis connection error', err);
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
