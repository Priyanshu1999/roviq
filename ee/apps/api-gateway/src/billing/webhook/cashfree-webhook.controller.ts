import { Controller, HttpCode, Logger, Param, Post, Req, Res } from '@nestjs/common';
import { NoAudit } from '@roviq/audit';
import { PaymentMethod } from '@roviq/ee-billing-types';
import { PaymentGatewayFactory } from '@roviq/ee-payments';
import type { Request, Response } from 'express';
import { PaymentService } from '../reseller/payment.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('webhooks')
export class CashfreeWebhookController {
  private readonly logger = new Logger(CashfreeWebhookController.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly paymentService: PaymentService,
  ) {}

  @Post('cashfree/:resellerId')
  @HttpCode(200)
  @NoAudit()
  async handle(
    @Param('resellerId') resellerId: string,
    @Req() req: RawBodyRequest,
    @Res() res: Response,
  ) {
    if (!req.rawBody) {
      this.logger.error('Cashfree webhook: rawBody not available');
      return res.status(400).json({ error: 'Raw body not available' });
    }

    try {
      const gateway = await this.gatewayFactory.create(resellerId, 'CASHFREE');
      const event = gateway.parseWebhook(req.rawBody, req.headers as Record<string, string>);

      if (event.gatewayPaymentId && event.amountPaise) {
        await this.paymentService.handleWebhookPayment(resellerId, {
          gatewayPaymentId: event.gatewayPaymentId,
          gatewayOrderId: event.gatewayOrderId,
          invoiceId: ((event.payload as Record<string, unknown>)['invoiceId'] as string) ?? '',
          tenantId: ((event.payload as Record<string, unknown>)['tenantId'] as string) ?? '',
          method: PaymentMethod.CASHFREE,
          amountPaise: BigInt(event.amountPaise),
          gatewayProvider: 'CASHFREE',
          gatewayResponse: event.payload,
        });
      }

      return res.json({ status: 'ok' });
    } catch (error) {
      this.logger.error(
        `Cashfree webhook failed for reseller ${resellerId}`,
        (error as Error).message,
      );
      return res.status(400).json({ error: 'Webhook processing failed' });
    }
  }
}
