'use client';

import { gql, useLazyQuery } from '@roviq/graphql';
import { useFormatDate, useFormatNumber, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import type { InvoiceNode } from './use-invoices';

const GENERATE_INVOICE_PDF = gql`
  query GenerateInvoicePdf($invoiceId: ID!) {
    generateInvoicePdf(invoiceId: $invoiceId)
  }
`;

/** Invoice status → badge variant mapping matching invoice-columns.tsx */
const INVOICE_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    DRAFT: 'outline',
    SENT: 'outline',
    PAID: 'default',
    PARTIALLY_PAID: 'secondary',
    OVERDUE: 'destructive',
    CANCELLED: 'secondary',
    REFUNDED: 'secondary',
  };

/** Shape of a single line item coming from the GraphQL lineItems JSON field */
interface LineItem {
  description: string;
  quantity: number;
  unitAmountPaise: string;
  totalAmountPaise: string;
  taxRate: number;
  taxAmountPaise: string;
  sacCode?: string;
}

/** Shape of the GST sub-object within taxBreakdown */
interface GstBreakdown {
  rate: number;
  amount: number;
  sacCode?: string;
}

/** Shape of the taxBreakdown JSON field */
interface TaxBreakdown {
  gst?: GstBreakdown;
  cgst?: GstBreakdown;
  sgst?: GstBreakdown;
  igst?: GstBreakdown;
}

/**
 * Hook encapsulating the invoice PDF download logic.
 * Calls the generateInvoicePdf query, decodes the base64 result, and triggers a download.
 */
function useInvoicePdfDownload(t: (key: string) => string) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [fetchPdf] = useLazyQuery<{ generateInvoicePdf: string }>(GENERATE_INVOICE_PDF);

  const download = async (invoice: InvoiceNode) => {
    setIsDownloading(true);
    try {
      const { data: pdfData } = await fetchPdf({ variables: { invoiceId: invoice.id } });
      if (pdfData?.generateInvoicePdf) {
        const byteChars = atob(pdfData.generateInvoicePdf);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoice.invoiceNumber || invoice.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error(t('invoices.detail.downloadPdfError'));
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloading, download };
}

/** Renders the GST/tax breakdown rows — extracted to reduce InvoiceDetail complexity */
function TaxBreakdownRows({
  taxBreakdown,
  taxTotal,
  formatCurrency,
  t,
}: {
  taxBreakdown: TaxBreakdown | null;
  taxTotal: number;
  formatCurrency: (n: number) => string;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  if (taxBreakdown?.cgst && taxBreakdown?.sgst) {
    return (
      <>
        <DetailRow label={t('invoices.detail.cgst', { rate: String(taxBreakdown.cgst.rate / 2) })}>
          {formatCurrency(taxBreakdown.cgst.amount / 100)}
        </DetailRow>
        <DetailRow label={t('invoices.detail.sgst', { rate: String(taxBreakdown.sgst.rate / 2) })}>
          {formatCurrency(taxBreakdown.sgst.amount / 100)}
        </DetailRow>
      </>
    );
  }
  if (taxBreakdown?.igst) {
    return (
      <DetailRow label={t('invoices.detail.igst', { rate: String(taxBreakdown.igst.rate) })}>
        {formatCurrency(taxBreakdown.igst.amount / 100)}
      </DetailRow>
    );
  }
  if (taxBreakdown?.gst) {
    return (
      <DetailRow label={t('invoices.detail.gst', { rate: String(taxBreakdown.gst.rate) })}>
        {formatCurrency(taxBreakdown.gst.amount / 100)}
      </DetailRow>
    );
  }
  return (
    <DetailRow label={t('invoices.detail.gst', { rate: '18' })}>
      {formatCurrency(taxTotal)}
    </DetailRow>
  );
}

interface InvoiceDetailProps {
  invoice: InvoiceNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordPayment?: (invoiceId: string) => void;
  onIssueRefund?: (invoiceId: string) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm break-all">{children}</span>
    </div>
  );
}

export function InvoiceDetail({
  invoice,
  open,
  onOpenChange,
  onRecordPayment,
  onIssueRefund,
}: InvoiceDetailProps) {
  const t = useTranslations('billing');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const ti = useI18nField();
  const { isDownloading, download: downloadPdf } = useInvoicePdfDownload(t);

  const formatDate = (date: Date) => format(date, 'dd MMM yyyy');
  const formatCurrency = (amount: number) => currency(amount);

  const handleDownloadPdf = () => {
    if (invoice) downloadPdf(invoice);
  };

  /** Parse the paise string from GraphQL into a display-ready rupee amount */
  const paiseToCurrency = (paise: string | number) => formatCurrency(Number(paise) / 100);

  const lineItems: LineItem[] = (invoice?.lineItems ?? []) as LineItem[];
  const taxBreakdown = (invoice?.taxBreakdown ?? null) as TaxBreakdown | null;

  const subtotal = Number(invoice?.subtotalAmount ?? 0) / 100;
  const taxTotal = Number(invoice?.taxAmount ?? 0) / 100;
  const total = Number(invoice?.totalAmount ?? 0) / 100;
  const paid = Number(invoice?.paidAmount ?? 0) / 100;
  const balance = total - paid;

  /** Statuses where a manual payment can be recorded */
  const payableStatuses: Set<string> = new Set(['DRAFT', 'SENT', 'OVERDUE', 'PARTIALLY_PAID']);
  /** Whether this invoice can accept a manual payment */
  const canRecordPayment = payableStatuses.has(invoice?.status ?? '');
  /** Whether this invoice is eligible for a refund */
  const canIssueRefund = invoice?.status === 'PAID';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>{t('invoices.detail.title')}</SheetTitle>
              <SheetDescription>{t('invoices.detail.description')}</SheetDescription>
            </div>
            {invoice && (
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloading}
                onClick={handleDownloadPdf}
              >
                <Download className="me-1 size-4" />
                {isDownloading
                  ? t('invoices.detail.downloadingPdf')
                  : t('invoices.detail.downloadPdf')}
              </Button>
            )}
          </div>
        </SheetHeader>

        {invoice && (
          <div className="flex-1 px-4">
            <ScrollArea className="h-[calc(100vh-120px)]">
              <div className="space-y-1 pb-6 pt-4">
                {/* ---------- Invoice summary ---------- */}
                <DetailRow label={t('invoices.detail.id')}>
                  <span className="font-mono text-xs">{invoice.id}</span>
                </DetailRow>
                <DetailRow label={t('invoices.detail.institute')}>
                  {ti(invoice.subscription?.institute?.name)}
                </DetailRow>

                <Separator className="my-2" />

                <DetailRow label={t('invoices.detail.amount')}>{formatCurrency(total)}</DetailRow>
                <DetailRow label={t('invoices.detail.currency')}>{invoice.currency}</DetailRow>
                <DetailRow label={t('invoices.detail.status')}>
                  <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] ?? 'outline'}>
                    {t(`invoices.statuses.${invoice.status}`)}
                  </Badge>
                </DetailRow>

                <Separator className="my-2" />

                <DetailRow label={t('invoices.detail.billingPeriodStart')}>
                  {invoice.periodStart ? formatDate(new Date(invoice.periodStart)) : '—'}
                </DetailRow>
                <DetailRow label={t('invoices.detail.billingPeriodEnd')}>
                  {invoice.periodEnd ? formatDate(new Date(invoice.periodEnd)) : '—'}
                </DetailRow>
                <DetailRow label={t('invoices.detail.dueDate')}>
                  {invoice.dueAt ? formatDate(new Date(invoice.dueAt)) : '—'}
                </DetailRow>
                <DetailRow label={t('invoices.detail.paidAt')}>
                  {invoice.paidAt ? formatDate(new Date(invoice.paidAt)) : '—'}
                </DetailRow>

                <Separator className="my-2" />

                <DetailRow label={t('invoices.detail.createdAt')}>
                  {formatDate(new Date(invoice.createdAt))}
                </DetailRow>

                {/* ---------- Line items table ---------- */}
                {lineItems.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <h4 className="text-sm font-semibold mb-2">{t('invoices.detail.lineItems')}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">
                            {t('invoices.detail.lineItemDescription')}
                          </TableHead>
                          <TableHead className="text-xs text-right">
                            {t('invoices.detail.lineItemQty')}
                          </TableHead>
                          <TableHead className="text-xs text-right">
                            {t('invoices.detail.lineItemUnitPrice')}
                          </TableHead>
                          <TableHead className="text-xs text-right">
                            {t('invoices.detail.lineItemTax')}
                          </TableHead>
                          <TableHead className="text-xs text-right">
                            {t('invoices.detail.lineItemTotal')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item) => (
                          <TableRow key={`${item.description}-${item.unitAmountPaise}`}>
                            <TableCell className="text-xs">{item.description}</TableCell>
                            <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">
                              {paiseToCurrency(item.unitAmountPaise)}
                            </TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">
                              {paiseToCurrency(item.taxAmountPaise)}
                            </TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">
                              {paiseToCurrency(item.totalAmountPaise)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}

                {/* ---------- Tax breakdown ---------- */}
                <Separator className="my-3" />
                <h4 className="text-sm font-semibold mb-2">{t('invoices.detail.taxBreakdown')}</h4>
                <div className="space-y-1">
                  <DetailRow label={t('invoices.detail.subtotal')}>
                    {formatCurrency(subtotal)}
                  </DetailRow>

                  <TaxBreakdownRows
                    taxBreakdown={taxBreakdown}
                    taxTotal={taxTotal}
                    formatCurrency={formatCurrency}
                    t={t}
                  />

                  <Separator className="my-1" />

                  <DetailRow label={t('invoices.detail.totalAmount')}>
                    <span className="font-semibold">{formatCurrency(total)}</span>
                  </DetailRow>
                  <DetailRow label={t('invoices.detail.paidAmount')}>
                    {formatCurrency(paid)}
                  </DetailRow>
                  {balance > 0 && (
                    <DetailRow label={t('invoices.detail.balanceDue')}>
                      <span className="font-semibold text-destructive">
                        {formatCurrency(balance)}
                      </span>
                    </DetailRow>
                  )}
                </div>

                {/* ---------- Action buttons ---------- */}
                <Separator className="my-3" />
                <div className="flex gap-2">
                  <Can I="update" a="Invoice">
                    {canRecordPayment && onRecordPayment && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onRecordPayment(invoice.id)}
                      >
                        {t('invoices.detail.recordPaymentBtn')}
                      </Button>
                    )}
                  </Can>
                  <Can I="update" a="Payment">
                    {canIssueRefund && onIssueRefund && (
                      <Button variant="outline" size="sm" onClick={() => onIssueRefund(invoice.id)}>
                        {t('invoices.detail.issueRefundBtn')}
                      </Button>
                    )}
                  </Can>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
