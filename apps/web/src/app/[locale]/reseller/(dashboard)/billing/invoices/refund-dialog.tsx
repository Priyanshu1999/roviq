'use client';

import { extractGraphQLError, gql, useMutation } from '@roviq/graphql';
import { useFormatNumber } from '@roviq/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldGroup,
  FieldInfoPopover,
  FieldLabel,
  Input,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

const { resellerBillingInvoices } = testIds;
const ISSUE_REFUND = gql`
  mutation IssueRefund($paymentId: ID!, $input: RefundInput!) {
    issueRefund(paymentId: $paymentId, input: $input) { id status }
  }
`;

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  maxRefundPaise: number;
}

export function RefundDialog({ open, onOpenChange, paymentId, maxRefundPaise }: RefundDialogProps) {
  const t = useTranslations('billing');
  const { currency: formatCurrency } = useFormatNumber();
  const [issueRefund] = useMutation(ISSUE_REFUND, { refetchQueries: ['Invoices'] });
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const maxRupees = maxRefundPaise / 100;

  React.useEffect(() => {
    if (open) {
      setAmount(String(maxRupees));
      setReason('');
    }
  }, [open, maxRupees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const amountPaise = String(Math.round(Number(amount) * 100));
      await issueRefund({
        variables: {
          paymentId,
          input: { amountPaise, reason: reason || undefined },
        },
      });
      toast.success(t('invoices.refund.success'));
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGraphQLError(err, t('invoices.refund.error')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('invoices.refund.title')}</DialogTitle>
          <DialogDescription>
            {t('invoices.refund.description', { max: formatCurrency(maxRupees) })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="refundAmount">
                {t('invoices.refund.amount')}
                <FieldInfoPopover
                  title={t('invoices.refund.fieldHelp.amountTitle')}
                  data-testid={resellerBillingInvoices.refundAmountInfo}
                >
                  <p>{t('invoices.refund.fieldHelp.amountBody')}</p>
                </FieldInfoPopover>
              </FieldLabel>
              <Input
                id="refundAmount"
                type="number"
                min="0"
                max={maxRupees}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="refundReason">
                {t('invoices.refund.reason')}
                <FieldInfoPopover
                  title={t('invoices.refund.fieldHelp.reasonTitle')}
                  data-testid={resellerBillingInvoices.refundReasonInfo}
                >
                  <p>{t('invoices.refund.fieldHelp.reasonBody')}</p>
                </FieldInfoPopover>
              </FieldLabel>
              <Input
                id="refundReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('invoices.refund.reasonPlaceholder')}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('invoices.refund.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting || !amount}>
              {isSubmitting ? t('invoices.refund.processing') : t('invoices.refund.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
