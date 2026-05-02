import { Module } from '@nestjs/common';
import { SUBSCRIPTION_READER } from '@roviq/common-types';
import { PaymentsModule } from '@roviq/ee-payments';
import './billing.enums';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { BillingEventConsumer } from './billing-event.consumer';
import {
  InstituteBillingSubscriptions,
  ResellerBillingSubscriptions,
} from './billing-subscriptions.resolver';
import { EntitlementCacheConsumer } from './entitlement-cache.consumer';
import { InstituteBillingResolver } from './institute/institute-billing.resolver';
import { InvoiceFieldResolver } from './invoice-field.resolver';
import { PlanFieldResolver } from './plan-field.resolver';
import { GatewayConfigRepository } from './repositories/gateway-config.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { PlanRepository } from './repositories/plan.repository';
import { SubscriptionRepository } from './repositories/subscription.repository';
import { DashboardService } from './reseller/dashboard.service';
import { GatewayConfigService } from './reseller/gateway-config.service';
import { InvoiceService } from './reseller/invoice.service';
import { InvoicePdfService } from './reseller/invoice-pdf.service';
import { PaymentService } from './reseller/payment.service';
import { PlanService } from './reseller/plan.service';
import { ResellerBillingResolver } from './reseller/reseller-billing.resolver';
import { SubscriptionService } from './reseller/subscription.service';
import { SubscriptionReaderImpl } from './subscription-reader.impl';
import { CashfreeWebhookController } from './webhook/cashfree-webhook.controller';
import { RazorpayWebhookController } from './webhook/razorpay-webhook.controller';
import { BillingScheduleService } from './workflows/billing.schedule';
import { BillingWorkerService } from './workflows/billing.worker';

@Module({
  imports: [PaymentsModule],
  controllers: [RazorpayWebhookController, CashfreeWebhookController],
  providers: [
    BillingRepository,
    PlanRepository,
    SubscriptionRepository,
    InvoiceRepository,
    PaymentRepository,
    GatewayConfigRepository,
    BillingService,
    PlanService,
    SubscriptionService,
    InvoiceService,
    InvoicePdfService,
    PaymentService,
    GatewayConfigService,
    DashboardService,
    { provide: SUBSCRIPTION_READER, useClass: SubscriptionReaderImpl },
    EntitlementCacheConsumer,
    BillingEventConsumer,
    ResellerBillingResolver,
    InstituteBillingResolver,
    InvoiceFieldResolver,
    PlanFieldResolver,
    InstituteBillingSubscriptions,
    ResellerBillingSubscriptions,
    BillingWorkerService,
    BillingScheduleService,
  ],
  exports: [SUBSCRIPTION_READER],
})
export class BillingModule {}
