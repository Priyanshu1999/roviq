import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { getRequestContext } from '@roviq/common-types';
import type { InvoiceLineItem } from '@roviq/ee-database';
import { pubSub } from '@roviq/pubsub';
import { billingError } from '../billing.errors';
import { InvoiceRepository } from '../repositories/invoice.repository';

/** GST rate — 18% on software services (SAC 998393) */
const GST_RATE = 18;
const GST_SAC_CODE = '998393';
/** Invoice due in 15 days from issue */
const DUE_DAYS = 15;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
    pubSub.publish(pattern, data);
  }

  /**
   * Generate an invoice for a subscription period.
   * Builds line items from plan, adds 18% GST, sets due date.
   */
  async generateInvoice(
    resellerId: string,
    resellerCode: string,
    input: {
      tenantId: string;
      subscriptionId: string;
      planName: string;
      planAmountPaise: bigint;
      periodStart: Date;
      periodEnd: Date;
      prorationCreditPaise?: number;
    },
  ) {
    const { userId } = getRequestContext();
    const now = new Date();

    // Build line items
    const lineItems: InvoiceLineItem[] = [];
    const planAmount = Number(input.planAmountPaise);

    // Plan subscription line item
    const taxOnPlan = Math.round((planAmount * GST_RATE) / 100);
    lineItems.push({
      description: `Subscription: ${input.planName}`,
      quantity: 1,
      unitAmountPaise: String(planAmount),
      totalAmountPaise: String(planAmount),
      taxRate: GST_RATE,
      taxAmountPaise: String(taxOnPlan),
      sacCode: GST_SAC_CODE,
    });

    // Proration credit (negative line item from plan change)
    if (input.prorationCreditPaise && input.prorationCreditPaise > 0) {
      const creditTax = Math.round((input.prorationCreditPaise * GST_RATE) / 100);
      lineItems.push({
        description: 'Proration credit (plan change)',
        quantity: 1,
        unitAmountPaise: String(-input.prorationCreditPaise),
        totalAmountPaise: String(-input.prorationCreditPaise),
        taxRate: GST_RATE,
        taxAmountPaise: String(-creditTax),
        sacCode: GST_SAC_CODE,
      });
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, li) => sum + Number(li.totalAmountPaise), 0);
    const tax = lineItems.reduce((sum, li) => sum + Number(li.taxAmountPaise), 0);
    const total = subtotal + tax;

    // Generate invoice number
    const invoiceNumber = await this.invoiceRepo.nextInvoiceNumber(resellerId, resellerCode);

    // Due date = issued + 15 days
    const dueAt = new Date(now.getTime() + DUE_DAYS * 86_400_000);

    const invoice = await this.invoiceRepo.create(resellerId, {
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      resellerId,
      invoiceNumber,
      status: 'SENT',
      subtotalAmount: BigInt(Math.max(0, subtotal)),
      taxAmount: BigInt(Math.max(0, tax)),
      totalAmount: BigInt(Math.max(0, total)),
      paidAmount: 0n,
      currency: 'INR',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      issuedAt: now,
      dueAt,
      lineItems,
      taxBreakdown: { gst: { rate: GST_RATE, amount: tax, sacCode: GST_SAC_CODE } },
      createdBy: userId,
      updatedBy: userId,
    });

    this.emitEvent('BILLING.invoice.generated', {
      invoiceId: invoice.id,
      tenantId: input.tenantId,
      totalAmount: total,
    });

    return invoice;
  }

  async getInvoice(resellerId: string, id: string) {
    const invoice = await this.invoiceRepo.findById(resellerId, id);
    if (!invoice) billingError('INVOICE_NOT_FOUND', 'Invoice not found');
    return invoice;
  }

  async listInvoices(
    resellerId: string,
    params: {
      tenantId?: string;
      status?: string;
      from?: Date;
      to?: Date;
      first: number;
      after?: string;
    },
  ) {
    return this.invoiceRepo.findByResellerId(resellerId, params);
  }

  /** Mark invoice as paid (called after payment succeeds) */
  async markPaid(resellerId: string, invoiceId: string, paidAmountPaise: bigint) {
    const invoice = await this.invoiceRepo.findById(resellerId, invoiceId);
    if (!invoice) return;

    const newPaidAmount = Number(invoice.paidAmount) + Number(paidAmountPaise);
    const totalAmount = Number(invoice.totalAmount);
    const isPaid = newPaidAmount >= totalAmount;

    await this.invoiceRepo.updateStatus(resellerId, invoiceId, {
      paidAmount: BigInt(newPaidAmount),
      status: isPaid ? 'PAID' : 'PARTIALLY_PAID',
      paidAt: isPaid ? new Date() : invoice.paidAt,
    });

    // Emit invoice.paid when fully paid — drives subscription reactivation (ROV-127)
    if (isPaid) {
      this.emitEvent('BILLING.invoice.paid', {
        invoiceId,
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        totalAmount: String(invoice.totalAmount),
      });
    }
  }

  /** Update invoice for refund */
  async markRefunded(resellerId: string, invoiceId: string, refundAmountPaise: bigint) {
    const invoice = await this.invoiceRepo.findById(resellerId, invoiceId);
    if (!invoice) return;

    const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - Number(refundAmountPaise));
    const isFullRefund = newPaidAmount === 0;

    await this.invoiceRepo.updateStatus(resellerId, invoiceId, {
      paidAmount: BigInt(newPaidAmount),
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_PAID',
    });
  }
}
