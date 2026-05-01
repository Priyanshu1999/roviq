'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Textarea,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { type ApplicationNode, useRejectApplication } from '../use-admission';

const { instituteAdmissionApplications } = testIds;
export interface RejectApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: ApplicationNode | null;
  onRejected?: (applicationId: string) => void;
}

export function RejectApplicationDialog({
  open,
  onOpenChange,
  application,
  onRejected,
}: RejectApplicationDialogProps) {
  const t = useTranslations('admission');
  const [reject, { loading }] = useRejectApplication();
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  const handleConfirm = async () => {
    if (!application) return;
    try {
      await reject({
        variables: { id: application.id, reason: reason || undefined },
      });
      onRejected?.(application.id);
      onOpenChange(false);
    } catch (err) {
      const message = extractGraphQLError(err, t('applications.rejectDialog.error'));
      toast.error(t('applications.rejectDialog.error'), { description: message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid={instituteAdmissionApplications.rejectDialog}>
        <DialogHeader>
          <DialogTitle>{t('applications.rejectDialog.title')}</DialogTitle>
          <DialogDescription>{t('applications.rejectDialog.description')}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="reject-reason">
            {t('applications.rejectDialog.reasonLabel')}
          </FieldLabel>
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('applications.rejectDialog.reasonPlaceholder')}
            data-testid={instituteAdmissionApplications.rejectReasonInput}
          />
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid={instituteAdmissionApplications.rejectCancelBtn}
          >
            {t('applications.rejectDialog.cancel')}
          </Button>
          <Button
            type="button"
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={loading}
            onClick={handleConfirm}
            data-testid={instituteAdmissionApplications.rejectConfirmBtn}
          >
            {loading && <Loader2 aria-hidden="true" className="me-1 size-4 animate-spin" />}
            {t('applications.rejectDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
