import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { BillingFilterInput } from '../dto/billing-filter.input';
import { InvoiceModel } from '../models/invoice.model';
import { SubscriptionModel } from '../models/subscription.model';
import { InvoiceService } from '../reseller/invoice.service';
import { SubscriptionService } from '../reseller/subscription.service';

/**
 * Institute-scoped billing resolver.
 * Institutes can view their own subscription, invoices, and payment history — read-only.
 * Payment initiation/verification will be added in ROV-112.
 */
@Resolver()
@InstituteScope()
export class InstituteBillingResolver {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /** Returns current subscription with plan details. Returns null when no subscription (not error). */
  @Query(() => SubscriptionModel, { nullable: true, name: 'mySubscription' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Subscription')
  async mySubscription(@CurrentUser() user: AuthUser) {
    if (!user.tenantId || !user.resellerId) return null;
    return this.subscriptionService.getActiveByTenant(user.resellerId, user.tenantId);
  }

  @Query(() => [InvoiceModel], { name: 'myInvoices' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Invoice')
  async myInvoices(
    @CurrentUser() user: AuthUser,
    @Args('filter', { nullable: true }) filter?: BillingFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    if (!user.tenantId || !user.resellerId) return [];
    const { items } = await this.invoiceService.listInvoices(user.resellerId, {
      tenantId: user.tenantId,
      status: filter?.status,
      from: filter?.from,
      to: filter?.to,
      first: first ?? 20,
      after,
    });
    return items;
  }

  @Query(() => InvoiceModel, { nullable: true, name: 'myInvoice' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Invoice')
  async myInvoice(@CurrentUser() user: AuthUser, @Args('id', { type: () => ID }) id: string) {
    if (!user.resellerId) return null;
    const invoice = await this.invoiceService.getInvoice(user.resellerId, id);
    // Only return if it belongs to this tenant
    if (invoice.tenantId !== user.tenantId) return null;
    return invoice;
  }
}
