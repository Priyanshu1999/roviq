import { Injectable, Logger } from '@nestjs/common';
import { i18nDisplay } from '@roviq/database';
import type { InvoiceLineItem } from '@roviq/ee-database';
import { CryptoService } from '@roviq/ee-payments';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { billingError } from '../billing.errors';
import { GatewayConfigRepository } from '../repositories/gateway-config.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';

/** GST rate for display */
const GST_RATE = 18;

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly gatewayConfigRepo: GatewayConfigRepository,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Generate an invoice PDF on-demand (not stored).
   * Returns a Buffer containing the PDF bytes.
   * Includes QR code when reseller has UPI_DIRECT config and invoice is unpaid.
   */
  async generate(resellerId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.invoiceRepo.findById(resellerId, invoiceId);
    if (!invoice) billingError('INVOICE_NOT_FOUND', 'Invoice not found');

    const lineItems = (invoice.lineItems ?? []) as InvoiceLineItem[];

    // Build UPI QR if applicable
    let qrBuffer: Buffer | null = null;
    const payableStatuses = new Set(['SENT', 'PARTIALLY_PAID', 'OVERDUE']);
    if (payableStatuses.has(invoice.status)) {
      qrBuffer = await this.buildUpiQr(resellerId, invoice);
    }

    return this.renderPdf(invoice, lineItems, qrBuffer);
  }

  private async buildUpiQr(
    resellerId: string,
    invoice: { totalAmount: bigint; paidAmount: bigint; invoiceNumber: string },
  ): Promise<Buffer | null> {
    try {
      const configs = await this.gatewayConfigRepo.findByResellerId(resellerId);
      const upiConfig = configs.find((c) => c.provider === 'UPI_DIRECT' && c.status === 'ACTIVE');
      if (!upiConfig?.credentials) return null;

      const decrypted = this.crypto.decrypt(upiConfig.credentials as string) as { vpa?: string };
      if (!decrypted.vpa) return null;

      const balancePaise = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      if (balancePaise <= 0) return null;

      const uri = `upi://pay?pa=${encodeURIComponent(decrypted.vpa)}&pn=Roviq&am=${(balancePaise / 100).toFixed(2)}&tn=INV-${invoice.invoiceNumber}&cu=INR`;

      return await QRCode.toBuffer(uri, { width: 150, margin: 1 });
    } catch (err) {
      this.logger.warn('Failed to build UPI QR', (err as Error).message);
      return null;
    }
  }

  private renderPdf(
    invoice: {
      invoiceNumber: string;
      status: string;
      currency: string;
      subtotalAmount: bigint;
      taxAmount: bigint;
      totalAmount: bigint;
      paidAmount: bigint;
      periodStart: Date | null;
      periodEnd: Date | null;
      issuedAt: Date | null;
      dueAt: Date;
      notes: string | null;
      subscription?: { institute?: { id: string; name: Record<string, string> } | null } | null;
    },
    lineItems: InvoiceLineItem[],
    qrBuffer: Buffer | null,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const formatMoney = (paise: bigint | number | string) => {
        const rupees = Number(paise) / 100;
        return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };
      const formatDate = (d: Date | string | null) =>
        d
          ? new Date(d).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—';

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'right' });
      doc.fontSize(10).text(`#${invoice.invoiceNumber}`, { align: 'right' });
      doc.moveDown(0.5);

      // Reseller branding area
      doc.fontSize(14).text('Roviq', 50, 50);
      doc.fontSize(8).text('Platform Billing', 50, 68);
      doc.moveDown(2);

      // Institute info
      const instituteName = invoice.subscription?.institute
        ? i18nDisplay(invoice.subscription.institute.name)
        : 'Institute';
      doc.fontSize(10).text('Bill To:', 50, 120);
      doc.fontSize(12).text(instituteName, 50, 135);

      // Invoice details
      const detailsY = 120;
      doc.fontSize(9);
      doc.text(`Status: ${invoice.status}`, 350, detailsY);
      doc.text(`Issued: ${formatDate(invoice.issuedAt)}`, 350, detailsY + 14);
      doc.text(`Due: ${formatDate(invoice.dueAt)}`, 350, detailsY + 28);
      if (invoice.periodStart && invoice.periodEnd) {
        doc.text(
          `Period: ${formatDate(invoice.periodStart)} — ${formatDate(invoice.periodEnd)}`,
          350,
          detailsY + 42,
        );
      }

      // Line items table
      const tableTop = 200;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Qty', 280, tableTop, { width: 40, align: 'right' });
      doc.text('Unit Price', 330, tableTop, { width: 80, align: 'right' });
      doc.text('Tax', 420, tableTop, { width: 60, align: 'right' });
      doc.text('Total', 490, tableTop, { width: 60, align: 'right' });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();
      doc.font('Helvetica');

      let y = tableTop + 22;
      for (const item of lineItems) {
        doc.text(item.description, 50, y, { width: 220 });
        doc.text(String(item.quantity), 280, y, { width: 40, align: 'right' });
        doc.text(formatMoney(item.unitAmountPaise), 330, y, { width: 80, align: 'right' });
        doc.text(formatMoney(item.taxAmountPaise), 420, y, { width: 60, align: 'right' });
        doc.text(formatMoney(item.totalAmountPaise), 490, y, { width: 60, align: 'right' });
        y += 18;
      }

      // Totals
      y += 10;
      doc.moveTo(350, y).lineTo(550, y).stroke();
      y += 8;

      doc.fontSize(9);
      doc.text('Subtotal', 350, y);
      doc.text(formatMoney(invoice.subtotalAmount), 490, y, { width: 60, align: 'right' });
      y += 16;

      doc.text(`GST (${GST_RATE}%)`, 350, y);
      doc.text(formatMoney(invoice.taxAmount), 490, y, { width: 60, align: 'right' });
      y += 16;

      doc.moveTo(350, y).lineTo(550, y).stroke();
      y += 8;

      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Total', 350, y);
      doc.text(formatMoney(invoice.totalAmount), 490, y, { width: 60, align: 'right' });
      y += 18;

      doc.font('Helvetica').fontSize(9);
      doc.text('Paid', 350, y);
      doc.text(formatMoney(invoice.paidAmount), 490, y, { width: 60, align: 'right' });
      y += 16;

      const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      if (balance > 0) {
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Balance Due', 350, y);
        doc.text(formatMoney(balance), 490, y, { width: 60, align: 'right' });
        y += 20;
      }

      // QR code
      if (qrBuffer) {
        doc.font('Helvetica').fontSize(8);
        doc.text('Scan to pay via UPI:', 50, y + 10);
        doc.image(qrBuffer, 50, y + 24, { width: 120 });
      }

      // Notes
      if (invoice.notes) {
        doc.font('Helvetica').fontSize(8);
        doc.text(`Notes: ${invoice.notes}`, 50, y + (qrBuffer ? 160 : 20));
      }

      // Footer
      doc.fontSize(7).text('Generated by Roviq Platform Billing', 50, 770, { align: 'center' });

      doc.end();
    });
  }
}
