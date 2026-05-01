import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  assertInstituteWithReseller,
  assertResellerContext,
  CurrentUser,
  InstituteScope,
} from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { BillingFilterInput } from '../dto/billing-filter.input';
import { SubmitUpiProofInput } from '../dto/submit-upi-proof.input';
import { VerifyPaymentGqlInput } from '../dto/verify-payment.input';
import { InitiatePaymentResult } from '../models/initiate-payment-result.model';
import { InvoiceModel } from '../models/invoice.model';
import { PaymentModel } from '../models/payment.model';
import { SubscriptionModel } from '../models/subscription.model';
import { InvoiceService } from '../reseller/invoice.service';
import { InvoicePdfService } from '../reseller/invoice-pdf.service';
import { PaymentService } from '../reseller/payment.service';
import { SubscriptionService } from '../reseller/subscription.service';

/**
 * Institute-scoped billing resolver.
 * Institutes can view their own subscription, invoices, initiate/verify payments.
 */
@Resolver()
@InstituteScope()
export class InstituteBillingResolver {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  /** Returns current subscription with plan details. Returns null when no subscription (not error). */
  @Query(() => SubscriptionModel, { nullable: true, name: 'mySubscription' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Subscription')
  async mySubscription(@CurrentUser() user: AuthUser) {
    // BI-003: institute users must always have both tenant + reseller context
    // by the time they reach billing. Throw a typed error instead of silently
    // returning null so misconfigured JWTs surface as ForbiddenException
    // (observable in logs, actionable in UI) rather than a confusing
    // "no subscription" empty state.
    assertInstituteWithReseller(user);
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
    assertInstituteWithReseller(user);
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
    assertInstituteWithReseller(user);
    const invoice = await this.invoiceService.getInvoice(user.resellerId, id);
    if (invoice.tenantId !== user.tenantId) return null;
    return invoice;
  }

  // ---------------------------------------------------------------------------
  // Payment flow (ROV-119 — gateway payment via institute)
  // ---------------------------------------------------------------------------

  @Mutation(() => InitiatePaymentResult, { name: 'initiatePayment' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'Payment')
  async initiatePayment(
    @CurrentUser() user: AuthUser,
    @Args('invoiceId', { type: () => ID }) invoiceId: string,
  ) {
    assertInstituteWithReseller(user);
    // Verify invoice belongs to this tenant
    const invoice = await this.invoiceService.getInvoice(user.resellerId, invoiceId);
    if (invoice.tenantId !== user.tenantId) {
      throw new Error('Invoice does not belong to this institute');
    }
    // Customer details are minimal from JWT — gateway adapters enrich from order context
    return this.paymentService.initiatePayment(user.resellerId, invoiceId, {
      name: user.tenantId ?? '',
      email: `billing+${user.tenantId}@roviq.com`,
      phone: '',
    });
  }

  @Mutation(() => PaymentModel, { name: 'verifyPayment' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'Payment')
  async verifyPayment(@CurrentUser() user: AuthUser, @Args('input') input: VerifyPaymentGqlInput) {
    assertResellerContext(user);
    return this.paymentService.verifyPayment(user.resellerId, input);
  }

  @Query(() => [PaymentModel], { name: 'myPaymentHistory' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Payment')
  async myPaymentHistory(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ) {
    assertInstituteWithReseller(user);
    const { items } = await this.paymentService.getPaymentHistory(user.resellerId, user.tenantId, {
      first: first ?? 20,
      after,
    });
    return items;
  }

  // ---------------------------------------------------------------------------
  // UPI P2P payment (ROV-119 — institute submits UTR proof)
  // ---------------------------------------------------------------------------

  @Mutation(() => PaymentModel, { name: 'submitUpiProof' })
  @UseGuards(AbilityGuard)
  @CheckAbility('create', 'Payment')
  async instituteSubmitUpiProof(
    @CurrentUser() user: AuthUser,
    @Args('input') input: SubmitUpiProofInput,
  ) {
    assertInstituteWithReseller(user);
    // Verify invoice belongs to this tenant
    const invoice = await this.invoiceService.getInvoice(user.resellerId, input.invoiceId);
    if (invoice.tenantId !== user.tenantId) {
      throw new Error('Invoice does not belong to this institute');
    }
    return this.paymentService.submitUpiProof(
      user.resellerId,
      input.invoiceId,
      input.utrNumber,
      user.membershipId,
    );
  }

  // ---------------------------------------------------------------------------
  // Invoice PDF (ROV-119 — on-demand PDF with optional UPI QR)
  // ---------------------------------------------------------------------------

  @Query(() => String, { name: 'generateInvoicePdf', description: 'Returns base64-encoded PDF' })
  @UseGuards(AbilityGuard)
  @CheckAbility('read', 'Invoice')
  async instituteGenerateInvoicePdf(
    @CurrentUser() user: AuthUser,
    @Args('invoiceId', { type: () => ID }) invoiceId: string,
  ) {
    assertInstituteWithReseller(user);
    const invoice = await this.invoiceService.getInvoice(user.resellerId, invoiceId);
    if (invoice.tenantId !== user.tenantId) {
      throw new Error('Invoice does not belong to this institute');
    }
    const pdfBuffer = await this.pdfService.generate(user.resellerId, invoiceId);
    return pdfBuffer.toString('base64');
  }
}
