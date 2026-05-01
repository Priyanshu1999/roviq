'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { type ApplicationNode, useApproveApplication } from '../use-admission';

const { instituteAdmissionApplications } = testIds;
export interface ApproveApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: ApplicationNode | null;
  onApproved?: (applicationId: string) => void;
}

/**
 * Confirmation dialog for `fee_paid → enrolled`. Triggers the
 * StudentAdmissionWorkflow on the backend; the parent page tracks the
 * pending state until the applicationStatusChanged subscription fires.
 *
 * Per [PLNIH] significant operations get a consequence dialog, not a soft
 * delete — enrolment is a one-way action.
 */
export function ApproveApplicationDialog({
  open,
  onOpenChange,
  application,
  onApproved,
}: ApproveApplicationDialogProps) {
  const t = useTranslations('admission');
  const [approve, { loading }] = useApproveApplication();

  const handleConfirm = async () => {
    if (!application) return;
    try {
      await approve({ variables: { id: application.id } });
      onApproved?.(application.id);
      onOpenChange(false);
    } catch (err) {
      const message = extractGraphQLError(err, t('applications.approveDialog.error'));
      toast.error(t('applications.approveDialog.error'), { description: message });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={instituteAdmissionApplications.approveDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('applications.approveDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('applications.approveDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            data-testid={instituteAdmissionApplications.approveCancelBtn}
          >
            {t('applications.approveDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={handleConfirm}
            data-testid={instituteAdmissionApplications.approveConfirmBtn}
          >
            {loading && <Loader2 aria-hidden="true" className="me-1 size-4 animate-spin" />}
            {t('applications.approveDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
