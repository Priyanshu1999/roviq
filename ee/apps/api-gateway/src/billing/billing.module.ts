import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsModule } from '@roviq/ee-payments';
import { JetStreamClient } from '@roviq/nats-jetstream';
import './billing.enums';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { InstituteBillingResolver } from './institute/institute-billing.resolver';
import { InvoiceRepository } from './repositories/invoice.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { PlanRepository } from './repositories/plan.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { InvoiceService } from './reseller/invoice.service';
import { PaymentService } from './reseller/payment.service';
import { PlanService } from './reseller/plan.service';
import { ResellerBillingResolver } from './reseller/reseller-billing.resolver';
import { SubscriptionService } from './reseller/subscription.service';
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
    PlanRepository,
    SubscriptionRepository,
    InvoiceRepository,
    PaymentRepository,
    BillingService,
    PlanService,
    SubscriptionService,
    InvoiceService,
    PaymentService,
    ResellerBillingResolver,
    InstituteBillingResolver,
  ],
})
export class BillingModule {}
