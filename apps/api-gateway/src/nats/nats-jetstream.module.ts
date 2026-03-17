import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JetStreamClient } from '@roviq/nats-jetstream';

@Global()
@Module({
  providers: [
    {
      provide: 'JETSTREAM_CLIENT',
      useFactory: async (config: ConfigService) => {
        const client = new JetStreamClient({
          servers: [config.getOrThrow<string>('NATS_URL')],
        });
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['JETSTREAM_CLIENT'],
})
export class NatsJetStreamModule {}
