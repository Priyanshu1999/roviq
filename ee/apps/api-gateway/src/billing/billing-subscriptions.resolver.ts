import { Resolver, Subscription } from '@nestjs/graphql';
import { InstituteScope, ResellerScope } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { pubSub } from '@roviq/pubsub';
import { InvoiceModel } from './models/invoice.model';
import { PaymentModel } from './models/payment.model';
import { SubscriptionModel } from './models/subscription.model';

// ---------------------------------------------------------------------------
// Institute-scoped subscriptions
// ---------------------------------------------------------------------------

@Resolver()
@InstituteScope()
export class InstituteBillingSubscriptions {
  @Subscription(() => SubscriptionModel, {
    name: 'mySubscriptionStatusChanged',
    filter: (
      payload: { tenantId: string },
      _args: unknown,
      context: { user: import('@roviq/common-types').InstituteContext },
    ) => payload.tenantId === context.user.tenantId,
  })
  mySubscriptionStatusChanged() {
    return pubSub.asyncIterableIterator('BILLING.subscription.status_changed');
  }

  @Subscription(() => InvoiceModel, {
    name: 'myInvoiceGenerated',
    filter: (
      payload: { tenantId: string },
      _args: unknown,
      context: { user: import('@roviq/common-types').InstituteContext },
    ) => payload.tenantId === context.user.tenantId,
  })
  myInvoiceGenerated() {
    return pubSub.asyncIterableIterator('BILLING.invoice.generated');
  }

  @Subscription(() => PaymentModel, {
    name: 'myPaymentStatusChanged',
    filter: (
      payload: { tenantId: string },
      _args: unknown,
      context: { user: import('@roviq/common-types').InstituteContext },
    ) => payload.tenantId === context.user.tenantId,
  })
  myPaymentStatusChanged() {
    return pubSub.asyncIterableIterator('BILLING.payment.status_changed');
  }
}

// ---------------------------------------------------------------------------
// Reseller-scoped subscriptions
// ---------------------------------------------------------------------------

@Resolver()
@ResellerScope()
export class ResellerBillingSubscriptions {
  @Subscription(() => InvoiceModel, {
    name: 'resellerInvoiceGenerated',
    filter: (
      payload: { resellerId: string },
      _args: unknown,
      context: { user: import('@roviq/common-types').ResellerContext },
    ) => payload.resellerId === context.user.resellerId,
  })
  resellerInvoiceGenerated() {
    return pubSub.asyncIterableIterator('BILLING.invoice.generated');
  }

  @Subscription(() => PaymentModel, {
    name: 'resellerPaymentReceived',
    filter: (
      payload: { resellerId: string },
      _args: unknown,
      context: { user: import('@roviq/common-types').ResellerContext },
    ) => payload.resellerId === context.user.resellerId,
  })
  resellerPaymentReceived() {
    return pubSub.asyncIterableIterator('BILLING.payment.succeeded');
  }

  @Subscription(() => SubscriptionModel, {
    name: 'resellerSubscriptionChanged',
    filter: (
      payload: { resellerId: string },
      _args: unknown,
      context: { user: import('@roviq/common-types').ResellerContext },
    ) => payload.resellerId === context.user.resellerId,
  })
  resellerSubscriptionChanged() {
    return pubSub.asyncIterableIterator('BILLING.subscription.status_changed');
  }
}
