'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate, useFormatNumber } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { CheckCircle, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  type UnverifiedPaymentNode,
  useRejectUpiPayment,
  useUnverifiedPayments,
  useVerifyUpiPayment,
} from './use-upi-verification';

/**
 * Formats a paise BigInt string into Indian-locale rupee display.
 * Values >= 1 Crore display as "X.XCr", >= 1 Lakh as "X.XL", otherwise "X,XXX".
 */
function formatPaiseToDisplay(paise: string): string {
  const rupees = Number(paise) / 100;
  if (rupees >= 1_00_00_000) {
    return `\u20B9${(rupees / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (rupees >= 1_00_000) {
    return `\u20B9${(rupees / 1_00_000).toFixed(1)}L`;
  }
  return `\u20B9${rupees.toLocaleString('en-IN')}`;
}

/**
 * Computes a human-readable countdown string from now to the deadline.
 * Returns null if deadline is passed.
 */
function useDeadlineCountdown(deadline: string | null): string | null {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return null;

  const remaining = new Date(deadline).getTime() - now;
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function DeadlineCell({ deadline }: { deadline: string | null }) {
  const countdown = useDeadlineCountdown(deadline);
  const t = useTranslations('billing');

  if (!deadline) return <span className="text-muted-foreground">—</span>;
  if (!countdown) {
    return (
      <Badge variant="destructive" className="text-xs">
        {t('upiVerification.expired')}
      </Badge>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      <Clock className="size-3" />
      {countdown}
    </span>
  );
}

export default function UpiVerificationPage() {
  const t = useTranslations('billing');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const { payments, loading } = useUnverifiedPayments({ first: 20 });
  const [verifyUpi] = useVerifyUpiPayment();
  const [rejectUpi] = useRejectUpiPayment();
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [rejectDialogPayment, setRejectDialogPayment] =
    React.useState<UnverifiedPaymentNode | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [isRejecting, setIsRejecting] = React.useState(false);

  const formatDate = React.useCallback((date: Date) => format(date, 'dd MMM yyyy'), [format]);

  const handleVerify = async (paymentId: string) => {
    setVerifyingId(paymentId);
    try {
      await verifyUpi({ variables: { paymentId } });
      toast.success(t('upiVerification.verifySuccess'));
    } catch (err) {
      toast.error(extractGraphQLError(err, t('upiVerification.verifyError')));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialogPayment) return;
    setIsRejecting(true);
    try {
      await rejectUpi({
        variables: {
          input: {
            paymentId: rejectDialogPayment.id,
            reason: rejectReason,
          },
        },
      });
      toast.success(t('upiVerification.rejectSuccess'));
      setRejectDialogPayment(null);
      setRejectReason('');
    } catch (err) {
      toast.error(extractGraphQLError(err, t('upiVerification.rejectError')));
    } finally {
      setIsRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('upiVerification.title')}</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('upiVerification.title')}</h1>
        <p className="text-muted-foreground">{t('upiVerification.description')}</p>
      </div>

      <Can I="read" a="Payment" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            payments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShieldAlert className="mb-4 size-12 text-muted-foreground" />
                  <p className="text-muted-foreground">{t('upiVerification.empty')}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('upiVerification.columns.invoiceId')}</TableHead>
                        <TableHead>{t('upiVerification.columns.utr')}</TableHead>
                        <TableHead className="text-right">
                          {t('upiVerification.columns.amount')}
                        </TableHead>
                        <TableHead>{t('upiVerification.columns.submittedAt')}</TableHead>
                        <TableHead>{t('upiVerification.columns.deadline')}</TableHead>
                        <TableHead className="text-right">
                          {t('upiVerification.columns.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-xs">
                            {payment.invoiceId.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.utrNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {formatPaiseToDisplay(payment.amountPaise)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDate(new Date(payment.createdAt))}
                          </TableCell>
                          <TableCell>
                            <DeadlineCell deadline={payment.verificationDeadline} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Can I="update" a="Payment">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  disabled={verifyingId === payment.id}
                                  onClick={() => handleVerify(payment.id)}
                                >
                                  <CheckCircle className="me-1 size-3" />
                                  {verifyingId === payment.id
                                    ? t('upiVerification.verifying')
                                    : t('upiVerification.verify')}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setRejectDialogPayment(payment);
                                    setRejectReason('');
                                  }}
                                >
                                  <XCircle className="me-1 size-3" />
                                  {t('upiVerification.reject')}
                                </Button>
                              </Can>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="flex h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">{t('upiVerification.accessDenied')}</p>
            </div>
          )
        }
      </Can>

      {/* Reject dialog with reason input */}
      <Dialog
        open={rejectDialogPayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialogPayment(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('upiVerification.rejectDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('upiVerification.rejectDialog.description', {
                amount: rejectDialogPayment
                  ? currency(Number(rejectDialogPayment.amountPaise) / 100)
                  : '',
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReject();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="rejectReason">
                  {t('upiVerification.rejectDialog.reason')}
                </FieldLabel>
                <Input
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('upiVerification.rejectDialog.reasonPlaceholder')}
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setRejectDialogPayment(null)}>
                {t('upiVerification.rejectDialog.cancel')}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isRejecting || !rejectReason.trim()}
              >
                {isRejecting
                  ? t('upiVerification.rejectDialog.rejecting')
                  : t('upiVerification.rejectDialog.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
