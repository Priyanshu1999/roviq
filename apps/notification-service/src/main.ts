import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { MicroserviceOptions } from '@nestjs/microservices';
import { JetStreamServer, STREAMS } from '@roviq/nats-jetstream';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    strategy: new JetStreamServer({
      servers: [config.get<string>('NATS_URL', 'nats://localhost:4222')],
      streams: Object.values(STREAMS),
      dlq: { enabled: true },
    }),
  });
  await app.startAllMicroservices();

  const port = config.get<number>('NOTIFICATION_SERVICE_PORT', 3002);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Notification service is running on: http://localhost:${port}`);
}

bootstrap();
