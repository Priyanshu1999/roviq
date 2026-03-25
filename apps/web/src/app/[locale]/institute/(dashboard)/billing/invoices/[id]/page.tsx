'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate, useFormatNumber } from '@roviq/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { ArrowLeft, CreditCard, Download, FileText, Loader2, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  useGenerateInvoicePdf,
  useInitiatePayment,
  useMyInvoice,
  useMyPaymentHistory,
  useSubmitUpiProof,
} from '../../use-billing';

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

/** Variant mapping for UPI P2P verification statuses */
const VERIFICATION_STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  /** Payment proof submitted, awaiting reseller review */
  PENDING_VERIFICATION: 'outline',
  /** Reseller confirmed the UTR payment is valid */
  VERIFIED: 'default',
  /** Reseller rejected the UTR — payment proof invalid */
  REJECTED: 'destructive',
  /** 24h verification window elapsed without reseller action */
  EXPIRED: 'secondary',
};

/** Extract VPA (pa= parameter) from a UPI payment URI */
function extractVpa(upiUri: string): string | null {
  try {
    const match = upiUri.match(/[?&]pa=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/** Validates that a UTR is 12–22 digits */
function isValidUtr(utr: string): boolean {
  return /^\d{12,22}$/.test(utr);
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const t = useTranslations('instituteBilling');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const { invoice, loading } = useMyInvoice(invoiceId);
  const { payments: allPayments, loading: paymentsLoading } = useMyPaymentHistory(100);

  const [submitUpiProof, { loading: submittingProof }] = useSubmitUpiProof();
  const [fetchPdf, { loading: pdfLoading }] = useGenerateInvoicePdf();
  const [initiatePayment, { loading: paymentLoading }] = useInitiatePayment();

  const [showUtrForm, setShowUtrForm] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [utrError, setUtrError] = useState('');

  /** Download invoice PDF as a file */
  const handleDownloadPdf = useCallback(async () => {
    try {
      const { data } = await fetchPdf({ variables: { invoiceId } });
      if (!data?.generateInvoicePdf) return;

      const byteChars = atob(data.generateInvoicePdf);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `invoice-${invoice?.invoiceNumber ?? invoiceId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractGraphQLError(err, 'Failed to download PDF'));
    }
  }, [fetchPdf, invoiceId, invoice?.invoiceNumber]);

  /** Submit UTR proof for UPI P2P payment */
  const handleSubmitUtr = useCallback(async () => {
    if (!isValidUtr(utrNumber)) {
      setUtrError(t('invoiceDetail.utrError'));
      return;
    }
    setUtrError('');
    try {
      await submitUpiProof({
        variables: { input: { invoiceId, utrNumber } },
      });
      toast.success(t('invoiceDetail.proofSubmitted'));
      setShowUtrForm(false);
      setUtrNumber('');
    } catch (err) {
      toast.error(extractGraphQLError(err, 'Failed to submit payment proof'));
    }
  }, [utrNumber, invoiceId, submitUpiProof, t]);

  /** Initiate gateway payment (Razorpay / redirect) */
  const handlePayOnline = useCallback(async () => {
    try {
      const { data } = await initiatePayment({ variables: { invoiceId } });
      if (!data?.initiatePayment) return;

      const { checkoutUrl } = data.initiatePayment;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      toast.error(extractGraphQLError(err, 'Failed to initiate payment'));
    }
  }, [initiatePayment, invoiceId]);

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
  const showUpiQr = invoice.upiPaymentUri && showPayButton;
  const vpa = invoice.upiPaymentUri ? extractVpa(invoice.upiPaymentUri) : null;
  const invoicePayments = allPayments.filter((p) => p.invoiceId === invoiceId);

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

      {/* Header with download PDF button */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('invoiceDetail.title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {t('invoiceDetail.invoiceNumber')}
            {invoice.invoiceNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={pdfLoading}>
            {pdfLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t('invoiceDetail.downloadPdf')}
          </Button>
          <Badge
            variant={INVOICE_STATUS_VARIANT[invoice.status] ?? 'secondary'}
            className="text-sm"
          >
            {t(`invoiceStatuses.${invoice.status}`)}
          </Badge>
        </div>
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

      {/* UPI QR Code section — shown when invoice has a UPI URI and is payable */}
      {showUpiQr && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-5" />
              {t('invoiceDetail.scanToPay')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <QRCodeSVG value={invoice.upiPaymentUri ?? ''} size={200} />
            {vpa && (
              <div className="text-center text-sm">
                <span className="text-muted-foreground">{t('invoiceDetail.vpaLabel')}: </span>
                <span className="font-mono font-medium">{vpa}</span>
              </div>
            )}
            {!showUtrForm ? (
              <Button variant="outline" onClick={() => setShowUtrForm(true)}>
                {t('invoiceDetail.iPaid')}
              </Button>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                <div>
                  <label htmlFor="utr-input" className="mb-1 block text-sm font-medium">
                    {t('invoiceDetail.utrLabel')}
                  </label>
                  <Input
                    id="utr-input"
                    placeholder={t('invoiceDetail.utrPlaceholder')}
                    value={utrNumber}
                    onChange={(e) => {
                      setUtrNumber(e.target.value);
                      if (utrError) setUtrError('');
                    }}
                    maxLength={22}
                  />
                  {utrError && <p className="mt-1 text-sm text-destructive">{utrError}</p>}
                </div>
                <Button onClick={handleSubmitUtr} disabled={submittingProof} className="w-full">
                  {submittingProof && <Loader2 className="size-4 animate-spin" />}
                  {t('invoiceDetail.submitProof')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pay Online / Pay Now buttons */}
      {showPayButton && (
        <div className="flex justify-end gap-2">
          <Button size="lg" variant="outline" onClick={handlePayOnline} disabled={paymentLoading}>
            {paymentLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            {t('invoiceDetail.payOnline')}
          </Button>
        </div>
      )}

      {/* Payment history for this invoice */}
      {invoicePayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invoiceDetail.paymentHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoicePayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{t(`methods.${payment.method}`)}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.paidAt
                        ? format(new Date(payment.paidAt), 'dd MMM yyyy, HH:mm')
                        : format(new Date(payment.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>
                    {payment.utrNumber && (
                      <p className="text-xs text-muted-foreground">UTR: {payment.utrNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {currency(Number(payment.amountPaise) / 100)}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          payment.status === 'SUCCEEDED'
                            ? 'default'
                            : payment.status === 'FAILED'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {t(`paymentStatuses.${payment.status}`)}
                      </Badge>
                      {payment.verificationStatus && (
                        <Badge
                          variant={
                            VERIFICATION_STATUS_VARIANT[payment.verificationStatus] ?? 'secondary'
                          }
                          className="text-xs"
                        >
                          {t(
                            `verification.${
                              payment.verificationStatus === 'PENDING_VERIFICATION'
                                ? 'pendingVerification'
                                : payment.verificationStatus.toLowerCase()
                            }`,
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history skeleton while loading */}
      {paymentsLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invoiceDetail.paymentHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
