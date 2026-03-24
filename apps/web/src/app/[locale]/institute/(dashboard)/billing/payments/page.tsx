'use client';

import { useFormatDate, useFormatNumber } from '@roviq/i18n';
import { Badge, Card, CardContent, Skeleton } from '@roviq/ui';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMyPaymentHistory } from '../use-billing';

const METHOD_ICONS: Record<string, string> = {
  RAZORPAY: '💳',
  CASHFREE: '🏦',
  UPI: '📱',
  BANK_TRANSFER: '🏦',
  CASH: '💵',
  CHEQUE: '📄',
};

const PAYMENT_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> =
  {
    PENDING: 'outline',
    PROCESSING: 'outline',
    SUCCEEDED: 'default',
    FAILED: 'destructive',
    REFUNDED: 'secondary',
    PARTIALLY_REFUNDED: 'secondary',
  };

export default function PaymentHistoryPage() {
  const t = useTranslations('instituteBilling');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const { payments, loading } = useMyPaymentHistory();

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('payments.title')}</h1>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('payments.title')}</h1>
      <p className="text-muted-foreground">{t('payments.description')}</p>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('payments.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{METHOD_ICONS[payment.method] ?? '💳'}</span>
                  <div>
                    <p className="font-medium">{t(`methods.${payment.method}`)}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.paidAt
                        ? format(new Date(payment.paidAt), 'dd MMM yyyy, HH:mm')
                        : format(new Date(payment.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>
                    {payment.invoiceId && (
                      <Link
                        href={`/billing/invoices/${payment.invoiceId}`}
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('payments.viewInvoice')}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">
                    {currency(Number(payment.amountPaise) / 100)}
                  </span>
                  <Badge variant={PAYMENT_STATUS_VARIANT[payment.status] ?? 'secondary'}>
                    {t(`paymentStatuses.${payment.status}`)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
