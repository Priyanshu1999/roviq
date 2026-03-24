import { Resolver, Subscription } from '@nestjs/graphql';
import { InstituteScope, ResellerScope } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { pubSub } from '@roviq/pubsub';
import { GraphQLJSON } from 'graphql-type-json';

// ---------------------------------------------------------------------------
// Institute-scoped subscriptions
// ---------------------------------------------------------------------------

@Resolver()
@InstituteScope()
export class InstituteBillingSubscriptions {
  @Subscription(() => GraphQLJSON, {
    name: 'mySubscriptionStatusChanged',
    filter: (payload: { tenantId: string }, _args: unknown, context: { user: AuthUser }) =>
      payload.tenantId === context.user.tenantId,
  })
  mySubscriptionStatusChanged() {
    return pubSub.asyncIterableIterator('BILLING.subscription.status_changed');
  }

  @Subscription(() => GraphQLJSON, {
    name: 'myInvoiceGenerated',
    filter: (payload: { tenantId: string }, _args: unknown, context: { user: AuthUser }) =>
      payload.tenantId === context.user.tenantId,
  })
  myInvoiceGenerated() {
    return pubSub.asyncIterableIterator('BILLING.invoice.generated');
  }

  @Subscription(() => GraphQLJSON, {
    name: 'myPaymentStatusChanged',
    filter: (payload: { tenantId: string }, _args: unknown, context: { user: AuthUser }) =>
      payload.tenantId === context.user.tenantId,
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
  @Subscription(() => GraphQLJSON, {
    name: 'resellerInvoiceGenerated',
    filter: (payload: { resellerId: string }, _args: unknown, context: { user: AuthUser }) =>
      payload.resellerId === context.user.resellerId,
  })
  resellerInvoiceGenerated() {
    return pubSub.asyncIterableIterator('BILLING.invoice.generated');
  }

  @Subscription(() => GraphQLJSON, {
    name: 'resellerPaymentReceived',
    filter: (payload: { resellerId: string }, _args: unknown, context: { user: AuthUser }) =>
      payload.resellerId === context.user.resellerId,
  })
  resellerPaymentReceived() {
    return pubSub.asyncIterableIterator('BILLING.payment.succeeded');
  }

  @Subscription(() => GraphQLJSON, {
    name: 'resellerSubscriptionChanged',
    filter: (payload: { resellerId: string }, _args: unknown, context: { user: AuthUser }) =>
      payload.resellerId === context.user.resellerId,
  })
  resellerSubscriptionChanged() {
    return pubSub.asyncIterableIterator('BILLING.subscription.status_changed');
  }
}
