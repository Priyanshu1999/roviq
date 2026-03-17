import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsModule } from '@roviq/ee-payments';
import { JetStreamClient } from '@roviq/nats-jetstream';
import './billing.enums';
import { BillingRepository } from './billing.repository';
import { BillingResolver } from './billing.resolver';
import { BillingService } from './billing.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [WebhookController],
  providers: [
    {
      provide: 'BILLING_NATS_CLIENT',
      useFactory: async (config: ConfigService) => {
        const client = new JetStreamClient({
          servers: [config.getOrThrow<string>('NATS_URL')],
        });
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    BillingRepository,
    BillingService,
    BillingResolver,
  ],
})
export class BillingModule {}
