import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { getRequestContext } from '@roviq/common-types';
import type { PaymentMethod } from '@roviq/ee-billing-types';
import { billingError } from '../billing.errors';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { InvoiceService } from './invoice.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly invoiceService: InvoiceService,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  // ---------------------------------------------------------------------------
  // Manual payment (reseller records)
  // ---------------------------------------------------------------------------

  async recordManualPayment(
    resellerId: string,
    invoiceId: string,
    input: {
      method: PaymentMethod;
      amountPaise: bigint;
      receiptNumber?: string;
      notes?: string;
    },
  ) {
    const invoice = await this.invoiceRepo.findById(resellerId, invoiceId);
    if (!invoice) billingError('PLAN_NOT_FOUND', 'Invoice not found');
    if (['PAID', 'CANCELLED', 'REFUNDED'].includes(invoice.status)) {
      billingError('INVOICE_ALREADY_PAID', 'Invoice is not payable');
    }

    const { userId } = getRequestContext();

    const payment = await this.paymentRepo.create(resellerId, {
      invoiceId,
      tenantId: invoice.tenantId,
      resellerId,
      status: 'SUCCEEDED',
      method: input.method,
      amountPaise: input.amountPaise,
      currency: invoice.currency,
      receiptNumber: input.receiptNumber ?? null,
      notes: input.notes ?? null,
      paidAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    // Update invoice paid amount
    await this.invoiceService.markPaid(resellerId, invoiceId, input.amountPaise);

    this.emitEvent('BILLING.payment.succeeded', {
      paymentId: payment.id,
      invoiceId,
      method: input.method,
      amountPaise: Number(input.amountPaise),
    });

    return payment;
  }

  // ---------------------------------------------------------------------------
  // Refund
  // ---------------------------------------------------------------------------

  async issueRefund(
    resellerId: string,
    paymentId: string,
    input: { amountPaise: bigint; reason?: string },
  ) {
    const payment = await this.paymentRepo.findById(resellerId, paymentId);
    if (!payment) billingError('PLAN_NOT_FOUND', 'Payment not found');
    if (payment.status !== 'SUCCEEDED') {
      billingError('INVOICE_NOT_PAYABLE', 'Can only refund succeeded payments');
    }

    // Validate refund doesn't exceed paid
    const paidAmount = Number(payment.amountPaise);
    const alreadyRefunded = Number(payment.refundedAmountPaise);
    const requestedRefund = Number(input.amountPaise);

    if (alreadyRefunded + requestedRefund > paidAmount) {
      billingError(
        'REFUND_EXCEEDS_PAID',
        `Refund of ₹${requestedRefund / 100} would exceed paid amount of ₹${paidAmount / 100}`,
      );
    }

    const newRefundedTotal = BigInt(alreadyRefunded + requestedRefund);
    const isFullRefund = Number(newRefundedTotal) >= paidAmount;

    const updated = await this.paymentRepo.update(resellerId, paymentId, {
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundedAmountPaise: newRefundedTotal,
      refundedAt: new Date(),
      refundReason: input.reason ?? null,
    });

    // Update invoice
    await this.invoiceService.markRefunded(resellerId, payment.invoiceId, input.amountPaise);

    this.emitEvent('BILLING.payment.refunded', {
      paymentId,
      invoiceId: payment.invoiceId,
      amountPaise: requestedRefund,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Webhook (idempotent)
  // ---------------------------------------------------------------------------

  async handleWebhookPayment(
    resellerId: string,
    input: {
      gatewayPaymentId: string;
      gatewayOrderId?: string;
      invoiceId: string;
      tenantId: string;
      method: PaymentMethod;
      amountPaise: bigint;
      gatewayProvider: string;
      gatewayResponse?: unknown;
    },
  ) {
    const { userId } = getRequestContext();

    const { payment, created } = await this.paymentRepo.findOrCreateByGatewayId(
      resellerId,
      input.gatewayPaymentId,
      {
        invoiceId: input.invoiceId,
        tenantId: input.tenantId,
        resellerId,
        status: 'SUCCEEDED',
        method: input.method,
        amountPaise: input.amountPaise,
        currency: 'INR',
        gatewayProvider: input.gatewayProvider,
        gatewayPaymentId: input.gatewayPaymentId,
        gatewayOrderId: input.gatewayOrderId ?? null,
        gatewayResponse: input.gatewayResponse ?? null,
        paidAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    );

    if (created) {
      await this.invoiceService.markPaid(resellerId, input.invoiceId, input.amountPaise);
      this.emitEvent('BILLING.payment.succeeded', {
        paymentId: payment.id,
        invoiceId: input.invoiceId,
        gatewayPaymentId: input.gatewayPaymentId,
      });
    }

    return payment;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async getPayment(resellerId: string, id: string) {
    return this.paymentRepo.findById(resellerId, id);
  }

  async getPaymentsByInvoice(resellerId: string, invoiceId: string) {
    return this.paymentRepo.findByInvoiceId(resellerId, invoiceId);
  }

  async getPaymentHistory(
    resellerId: string,
    tenantId: string,
    params: { first: number; after?: string },
  ) {
    return this.paymentRepo.findByTenantId(resellerId, tenantId, params);
  }
}
