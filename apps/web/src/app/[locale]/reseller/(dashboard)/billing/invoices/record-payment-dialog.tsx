'use client';

import { extractGraphQLError, gql, useMutation } from '@roviq/graphql';
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
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

const RECORD_PAYMENT = gql`
  mutation RecordManualPayment($invoiceId: ID!, $input: ManualPaymentInput!) {
    recordManualPayment(invoiceId: $invoiceId, input: $input) { id status }
  }
`;

const METHODS = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI'] as const;

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  remainingPaise: number;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  remainingPaise,
}: RecordPaymentDialogProps) {
  const t = useTranslations('billing');
  const [recordPayment] = useMutation(RECORD_PAYMENT, { refetchQueries: ['Invoices'] });
  const [method, setMethod] = React.useState<string>('CASH');
  const [amount, setAmount] = React.useState('');
  const [receiptNumber, setReceiptNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMethod('CASH');
      setAmount(String(remainingPaise / 100));
      setReceiptNumber('');
      setNotes('');
    }
  }, [open, remainingPaise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const amountPaise = String(Math.round(Number(amount) * 100));
      await recordPayment({
        variables: {
          invoiceId,
          input: {
            method,
            amountPaise,
            receiptNumber: receiptNumber || undefined,
            notes: notes || undefined,
          },
        },
      });
      toast.success(t('invoices.recordPayment.success'));
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGraphQLError(err, t('invoices.recordPayment.error')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('invoices.recordPayment.title')}</DialogTitle>
          <DialogDescription>{t('invoices.recordPayment.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('invoices.recordPayment.method')}</FieldLabel>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`invoices.recordPayment.methods.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="payAmount">{t('invoices.recordPayment.amount')}</FieldLabel>
              <Input
                id="payAmount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="receipt">{t('invoices.recordPayment.receiptNumber')}</FieldLabel>
              <Input
                id="receipt"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder={t('invoices.recordPayment.receiptPlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">{t('invoices.recordPayment.notes')}</FieldLabel>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('invoices.recordPayment.notesPlaceholder')}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting || !amount}>
              {isSubmitting
                ? t('invoices.recordPayment.recording')
                : t('invoices.recordPayment.record')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
