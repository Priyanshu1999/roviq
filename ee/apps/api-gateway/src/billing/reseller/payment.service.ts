import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { getRequestContext } from '@roviq/common-types';
import type { PaymentMethod } from '@roviq/ee-billing-types';
import { PaymentGatewayFactory } from '@roviq/ee-payments';
import { pubSub } from '@roviq/pubsub';
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
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly config: ConfigService,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
    pubSub.publish(pattern, data);
  }

  // ---------------------------------------------------------------------------
  // Gateway payment flow (institute initiates)
  // ---------------------------------------------------------------------------

  async initiatePayment(
    resellerId: string,
    invoiceId: string,
    customer: { name: string; email: string; phone: string },
  ) {
    const invoice = await this.invoiceRepo.findById(resellerId, invoiceId);
    if (!invoice) billingError('INVOICE_NOT_FOUND', 'Invoice not found');
    if (['PAID', 'CANCELLED', 'REFUNDED'].includes(invoice.status)) {
      billingError('INVOICE_NOT_PAYABLE', 'Invoice is not payable');
    }

    const gateway = await this.gatewayFactory.create(resellerId);
    const returnUrl = this.config.getOrThrow<string>('BILLING_RETURN_URL');

    const order = await gateway.createOrder({
      invoiceId,
      amountPaise: invoice.totalAmount - invoice.paidAmount,
      currency: invoice.currency,
      customer,
      returnUrl: `${returnUrl}?invoiceId=${invoiceId}`,
    });

    const { userId } = getRequestContext();

    // Create pending payment record
    const payment = await this.paymentRepo.create(resellerId, {
      invoiceId,
      tenantId: invoice.tenantId,
      resellerId,
      status: 'PENDING',
      method: order.gatewayProvider === 'CASHFREE' ? 'CASHFREE' : 'RAZORPAY',
      amountPaise: invoice.totalAmount - invoice.paidAmount,
      currency: invoice.currency,
      gatewayProvider: order.gatewayProvider,
      gatewayOrderId: order.gatewayOrderId,
      createdBy: userId,
      updatedBy: userId,
    });

    return {
      paymentId: payment.id,
      gatewayOrderId: order.gatewayOrderId,
      checkoutUrl: order.checkoutUrl,
      checkoutPayload: order.checkoutPayload,
    };
  }

  async verifyPayment(
    resellerId: string,
    input: { gatewayOrderId: string; gatewayPaymentId: string; signature: string },
  ) {
    const gateway = await this.gatewayFactory.create(resellerId);
    const isValid = await gateway.verifyPayment(input);

    if (!isValid) {
      billingError('PAYMENT_VERIFICATION_FAILED', 'Payment signature verification failed');
    }

    // Find the pending payment by gateway order ID
    const payments = await this.paymentRepo.findByGatewayOrderId(resellerId, input.gatewayOrderId);
    const pendingPayment = payments.find((p) => p.status === 'PENDING');
    if (!pendingPayment) {
      billingError('PAYMENT_NOT_FOUND', 'No pending payment found for this order');
    }

    // Mark payment as succeeded
    const updated = await this.paymentRepo.update(resellerId, pendingPayment.id, {
      status: 'SUCCEEDED',
      gatewayPaymentId: input.gatewayPaymentId,
      paidAt: new Date(),
    });

    // Update invoice
    await this.invoiceService.markPaid(
      resellerId,
      pendingPayment.invoiceId,
      pendingPayment.amountPaise,
    );

    this.emitEvent('BILLING.payment.succeeded', {
      paymentId: pendingPayment.id,
      invoiceId: pendingPayment.invoiceId,
      gatewayPaymentId: input.gatewayPaymentId,
    });

    return updated;
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
    if (!invoice) billingError('INVOICE_NOT_FOUND', 'Invoice not found');
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
    if (!payment) billingError('PAYMENT_NOT_FOUND', 'Payment not found');
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
