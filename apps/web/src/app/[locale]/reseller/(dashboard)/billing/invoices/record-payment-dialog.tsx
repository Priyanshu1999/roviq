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
  FieldInfoPopover,
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

const { resellerBillingInvoices } = testIds;
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
  const [collectedById, setCollectedById] = React.useState('');
  const [collectionDate, setCollectionDate] = React.useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMethod('CASH');
      setAmount(String(remainingPaise / 100));
      setReceiptNumber('');
      setNotes('');
      setCollectedById('');
      setCollectionDate(new Date().toISOString().split('T')[0]);
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
            ...(method === 'CASH'
              ? {
                  collectedById: collectedById || undefined,
                  collectionDate: collectionDate || undefined,
                }
              : {}),
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
              <FieldLabel>
                {t('invoices.recordPayment.method')}
                <FieldInfoPopover
                  title={t('invoices.recordPayment.fieldHelp.methodTitle')}
                  data-testid={resellerBillingInvoices.recordPaymentMethodInfo}
                >
                  <p>{t('invoices.recordPayment.fieldHelp.methodBody')}</p>
                  <p>
                    <em>{t('invoices.recordPayment.fieldHelp.methodOptions')}</em>
                  </p>
                </FieldInfoPopover>
              </FieldLabel>
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
              <FieldLabel htmlFor="receipt">
                {t('invoices.recordPayment.receiptNumber')}
                <FieldInfoPopover
                  title={t('invoices.recordPayment.fieldHelp.receiptNumberTitle')}
                  data-testid={resellerBillingInvoices.recordPaymentReceiptInfo}
                >
                  <p>{t('invoices.recordPayment.fieldHelp.receiptNumberBody')}</p>
                </FieldInfoPopover>
              </FieldLabel>
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

            {method === 'CASH' && (
              <>
                <Field>
                  <FieldLabel htmlFor="collectedById">
                    {t('invoices.recordPayment.collectedById')}
                    <FieldInfoPopover
                      title={t('invoices.recordPayment.fieldHelp.collectedByIdTitle')}
                      data-testid={resellerBillingInvoices.recordPaymentCollectedByInfo}
                    >
                      <p>{t('invoices.recordPayment.fieldHelp.collectedByIdBody')}</p>
                    </FieldInfoPopover>
                  </FieldLabel>
                  <Input
                    id="collectedById"
                    value={collectedById}
                    onChange={(e) => setCollectedById(e.target.value)}
                    placeholder={t('invoices.recordPayment.collectedByIdPlaceholder')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="collectionDate">
                    {t('invoices.recordPayment.collectionDate')}
                    <FieldInfoPopover
                      title={t('invoices.recordPayment.fieldHelp.collectionDateTitle')}
                      data-testid={resellerBillingInvoices.recordPaymentCollectionDateInfo}
                    >
                      <p>{t('invoices.recordPayment.fieldHelp.collectionDateBody')}</p>
                    </FieldInfoPopover>
                  </FieldLabel>
                  <Input
                    id="collectionDate"
                    type="date"
                    value={collectionDate}
                    onChange={(e) => setCollectionDate(e.target.value)}
                  />
                </Field>
              </>
            )}
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

import { testIds } from '@roviq/ui/testing/testid-registry';
