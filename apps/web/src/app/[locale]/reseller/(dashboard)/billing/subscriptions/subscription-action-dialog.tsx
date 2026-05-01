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
  FieldInfoPopover,
  FieldLabel,
  Input,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  useCancelSubscription,
  usePauseSubscription,
  useResumeSubscription,
} from './use-subscriptions';

type ActionType = 'pause' | 'resume' | 'cancel';

interface SubscriptionActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionType;
  subscriptionId: string;
}

export function SubscriptionActionDialog({
  open,
  onOpenChange,
  action,
  subscriptionId,
}: SubscriptionActionDialogProps) {
  const t = useTranslations('billing');
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [pauseSub] = usePauseSubscription();
  const [resumeSub] = useResumeSubscription();
  const [cancelSub] = useCancelSubscription();

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const needsReason = action === 'pause' || action === 'cancel';

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (action === 'pause') {
        await pauseSub({ variables: { input: { subscriptionId, reason: reason || undefined } } });
        toast.success(t('subscriptions.actions.pauseSuccess'));
      } else if (action === 'resume') {
        await resumeSub({ variables: { subscriptionId } });
        toast.success(t('subscriptions.actions.resumeSuccess'));
      } else if (action === 'cancel') {
        await cancelSub({ variables: { input: { subscriptionId, reason: reason || undefined } } });
        toast.success(t('subscriptions.actions.cancelSuccess'));
      }
      onOpenChange(false);
    } catch (err) {
      const fallback = t(`subscriptions.actions.${action}Error`);
      toast.error(extractGraphQLError(err, fallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t(`subscriptions.actions.${action}ConfirmTitle`)}</DialogTitle>
          <DialogDescription>{t(`subscriptions.actions.${action}Confirm`)}</DialogDescription>
        </DialogHeader>

        {needsReason && (
          <Field>
            <FieldLabel>
              {t('subscriptions.actions.reason')}
              <FieldInfoPopover
                title={t('subscriptions.actions.fieldHelp.reasonTitle')}
                data-testid={testIds.resellerBillingSubscriptions.subscriptionReasonInfo}
              >
                <p>{t('subscriptions.actions.fieldHelp.reasonBody')}</p>
              </FieldInfoPopover>
            </FieldLabel>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('subscriptions.actions.reasonPlaceholder')}
            />
          </Field>
        )}

        {action === 'cancel' && (
          <p className="text-sm text-destructive">{t('subscriptions.actions.cancelWarning')}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('subscriptions.actions.confirmCancel')}
          </Button>
          <Button
            variant={action === 'cancel' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('subscriptions.actions.executing')
              : t('subscriptions.actions.confirmProceed')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
