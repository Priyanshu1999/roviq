import crypto from 'node:crypto';
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') !== 'production';
        return {
          pinoHttp: {
            level: config.get<string>('LOG_LEVEL', 'info'),
            transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
            genReqId: (req) => req.headers['x-request-id']?.toString() || crypto.randomUUID(),
            // Reduce per-request noise in dev — log method, url, status, and duration only
            serializers: isDev
              ? {
                  req: (req) => ({ method: req.method, url: req.url }),
                  res: (res) => ({ statusCode: res.statusCode }),
                }
              : undefined,
            // Suppress successful request logs in dev (errors still logged)
            autoLogging: isDev ? { ignore: (req) => req.url === '/api/graphql' } : true,
          },
          forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
          exclude: [{ method: RequestMethod.ALL, path: 'health' }],
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class TelemetryModule {}
