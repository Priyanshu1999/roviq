'use client';

import { useFormatDate, useFormatNumber } from '@roviq/i18n';
import { Badge, Card, CardContent, Skeleton } from '@roviq/ui';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMyInvoices } from '../use-billing';

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

export default function InvoicesPage() {
  const t = useTranslations('instituteBilling');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const router = useRouter();
  const { invoices, loading } = useMyInvoices();

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('invoices.title')}</h1>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('invoices.title')}</h1>
      <p className="text-muted-foreground">{t('invoices.description')}</p>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('invoices.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card
              key={invoice.id}
              className="cursor-pointer hover:border-primary/50"
              onClick={() => router.push(`/billing/invoices/${invoice.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.periodStart && invoice.periodEnd
                      ? `${format(new Date(invoice.periodStart), 'dd MMM')} — ${format(new Date(invoice.periodEnd), 'dd MMM yyyy')}`
                      : format(new Date(invoice.createdAt), 'dd MMM yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">
                    {currency(Number(invoice.totalAmount) / 100)}
                  </span>
                  <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] ?? 'secondary'}>
                    {t(`invoiceStatuses.${invoice.status}`)}
                  </Badge>
                  {invoice.dueAt && (
                    <span className="text-xs text-muted-foreground">
                      {t('invoices.due')}: {format(new Date(invoice.dueAt), 'dd MMM')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
