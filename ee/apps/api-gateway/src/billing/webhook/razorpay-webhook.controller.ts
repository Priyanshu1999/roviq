import { Controller, HttpCode, Logger, Param, Post, Req, Res } from '@nestjs/common';
import { NoAudit } from '@roviq/audit';
import { PaymentMethod } from '@roviq/ee-billing-types';
import { PaymentGatewayFactory } from '@roviq/ee-payments';
import type { Request, Response } from 'express';
import { PaymentService } from '../reseller/payment.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/** Typed shape of webhook event payload containing billing metadata */
interface WebhookPayload {
  invoiceId?: string;
  tenantId?: string;
}

@Controller('webhooks')
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly paymentService: PaymentService,
  ) {}

  @Post('razorpay/:resellerId')
  @HttpCode(200)
  @NoAudit()
  async handle(
    @Param('resellerId') resellerId: string,
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ) {
    if (!req.rawBody) {
      this.logger.error('Razorpay webhook: rawBody not available');
      return res.status(400).json({ error: 'Raw body not available' });
    }

    try {
      const gateway = await this.gatewayFactory.create(resellerId, 'RAZORPAY');
      const event = gateway.parseWebhook(req.rawBody, req.headers as Record<string, string>);

      if (event.gatewayPaymentId && event.amountPaise) {
        const payload = event.payload as WebhookPayload;
        await this.paymentService.handleWebhookPayment(resellerId, {
          gatewayPaymentId: event.gatewayPaymentId,
          gatewayOrderId: event.gatewayOrderId,
          invoiceId: payload.invoiceId ?? '',
          tenantId: payload.tenantId ?? '',
          method: PaymentMethod.RAZORPAY,
          amountPaise: BigInt(event.amountPaise),
          gatewayProvider: 'RAZORPAY',
          gatewayResponse: event.payload,
        });
      }

      return res.json({ status: 'ok' });
    } catch (error) {
      this.logger.error(
        `Razorpay webhook failed for reseller ${resellerId}`,
        (error as Error).message,
      );
      return res.status(400).json({ error: 'Webhook processing failed' });
    }
  }
}
