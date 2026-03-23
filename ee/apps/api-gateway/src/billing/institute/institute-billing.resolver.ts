import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { BillingFilterInput } from '../dto/billing-filter.input';
import { InvoiceConnection } from '../models/invoice.model';
import { SubscriptionModel } from '../models/subscription.model';
import { SubscriptionService } from '../reseller/subscription.service';

/**
 * Institute-scoped billing resolver.
 * Institutes can view their own subscription and invoices — read-only.
 */
@Resolver()
@InstituteScope()
export class InstituteBillingResolver {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /** Returns current subscription with plan details. Returns null when no subscription (not error). */
  @Query(() => SubscriptionModel, { nullable: true, name: 'mySubscription' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Subscription')
  async mySubscription(@CurrentUser() user: AuthUser) {
    if (!user.tenantId || !user.resellerId) return null;
    return this.subscriptionService.getActiveByTenant(user.resellerId, user.tenantId);
  }

  @Query(() => InvoiceConnection, { name: 'myInvoices' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Invoice')
  async myInvoices(
    @CurrentUser() _user: AuthUser,
    @Args('filter', { nullable: true }) _filter?: BillingFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) _first?: number,
    @Args('after', { nullable: true }) _after?: string,
  ) {
    // TODO: ROV-119 — wire InvoiceService
    return {
      edges: [],
      totalCount: 0,
      pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
    };
  }
}
