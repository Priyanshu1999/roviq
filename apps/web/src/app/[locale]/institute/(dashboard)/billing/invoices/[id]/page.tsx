'use client';

import { useFormatDate, useFormatNumber } from '@roviq/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMyInvoice } from '../../use-billing';

/** Invoice status to badge variant mapping */
const INVOICE_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    DRAFT: 'secondary',
    SENT: 'outline',
    PAID: 'default',
    PARTIALLY_PAID: 'outline',
    OVERDUE: 'destructive',
    CANCELLED: 'secondary',
    REFUNDED: 'secondary',
  };

/** Statuses that allow payment action */
const PAYABLE_STATUSES = new Set(['SENT', 'PARTIALLY_PAID', 'OVERDUE']);

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const t = useTranslations('instituteBilling');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const { invoice, loading } = useMyInvoice(invoiceId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href="/billing/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('invoices.title')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t('invoiceDetail.title')}</h1>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Link
          href="/billing/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('invoices.title')}
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('invoices.empty')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lineItems = (invoice.lineItems ?? []) as Array<{
    description: string;
    quantity: number;
    unitPricePaise: string;
    taxPaise: string;
    totalPaise: string;
  }>;

  const balanceDue = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const showPayButton = PAYABLE_STATUSES.has(invoice.status);

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/billing/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('invoices.title')}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('invoiceDetail.title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {t('invoiceDetail.invoiceNumber')}
            {invoice.invoiceNumber}
          </p>
        </div>
        <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] ?? 'secondary'} className="text-sm">
          {t(`invoiceStatuses.${invoice.status}`)}
        </Badge>
      </div>

      {/* Dates */}
      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
          {invoice.issuedAt && (
            <div>
              <span className="text-sm text-muted-foreground">{t('invoiceDetail.issuedAt')}</span>
              <p className="font-medium">{format(new Date(invoice.issuedAt), 'dd MMM yyyy')}</p>
            </div>
          )}
          {invoice.dueAt && (
            <div>
              <span className="text-sm text-muted-foreground">{t('invoiceDetail.dueAt')}</span>
              <p className="font-medium">{format(new Date(invoice.dueAt), 'dd MMM yyyy')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line items table */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invoiceDetail.lineItems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoiceDetail.description')}</TableHead>
                  <TableHead className="text-end">{t('invoiceDetail.quantity')}</TableHead>
                  <TableHead className="text-end">{t('invoiceDetail.unitPrice')}</TableHead>
                  <TableHead className="text-end">{t('invoiceDetail.tax')}</TableHead>
                  <TableHead className="text-end">{t('invoiceDetail.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={`${item.description}-${item.unitPricePaise}`}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-end">{item.quantity}</TableCell>
                    <TableCell className="text-end">
                      {currency(Number(item.unitPricePaise) / 100)}
                    </TableCell>
                    <TableCell className="text-end">
                      {currency(Number(item.taxPaise) / 100)}
                    </TableCell>
                    <TableCell className="text-end">
                      {currency(Number(item.totalPaise) / 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tax breakdown and totals */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('invoiceDetail.subtotal')}</span>
            <span>{currency(Number(invoice.subtotalAmount) / 100)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('invoiceDetail.gst')}</span>
            <span>{currency(Number(invoice.taxAmount) / 100)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>{t('invoiceDetail.total')}</span>
            <span>{currency(Number(invoice.totalAmount) / 100)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('invoiceDetail.paid')}</span>
            <span>{currency(Number(invoice.paidAmount) / 100)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>{t('invoiceDetail.balance')}</span>
            <span>{currency(balanceDue / 100)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pay Now button */}
      {showPayButton && (
        <div className="flex justify-end">
          <Button size="lg">{t('invoiceDetail.payNow')}</Button>
        </div>
      )}
    </div>
  );
}
