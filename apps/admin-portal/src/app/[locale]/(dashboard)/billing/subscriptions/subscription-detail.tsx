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
  Badge,
  Button,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@roviq/ui';
import * as React from 'react';
import { toast } from 'sonner';
import {
  type SubscriptionNode,
  useCancelSubscription,
  usePauseSubscription,
  useResumeSubscription,
} from './use-subscriptions';

interface SubscriptionDetailProps {
  subscription: SubscriptionNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
  formatDate: (date: Date) => string;
  formatCurrency: (amount: number) => string;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm break-all">{children}</span>
    </div>
  );
}

function OptionalValue({
  value,
  formatDate,
}: {
  value?: string | null;
  formatDate: (d: Date) => string;
}) {
  return value ? formatDate(new Date(value)) : '\u2014';
}

type ConfirmAction =
  | { type: 'cancel'; atCycleEnd: boolean }
  | { type: 'pause' }
  | { type: 'resume' };

function ActionButtons({
  subscription,
  onAction,
  t,
}: {
  subscription: SubscriptionNode;
  onAction: (action: ConfirmAction) => void;
  t: (key: string) => string;
}) {
  const { status } = subscription;
  const hasProvider = !!subscription.providerSubscriptionId;
  const isTerminal = status === 'CANCELED' || status === 'COMPLETED';
  const canCancel = !isTerminal;
  const canPause = hasProvider && status === 'ACTIVE';
  const canResume = hasProvider && status === 'PAUSED';

  if (!canCancel && !canPause && !canResume) return null;

  return (
    <>
      <Separator className="my-4" />
      <div className="flex flex-wrap gap-2">
        {canResume && (
          <Button size="sm" onClick={() => onAction({ type: 'resume' })}>
            {t('subscriptions.actions.resume')}
          </Button>
        )}
        {canPause && (
          <Button variant="outline" size="sm" onClick={() => onAction({ type: 'pause' })}>
            {t('subscriptions.actions.pause')}
          </Button>
        )}
        {canCancel && hasProvider && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAction({ type: 'cancel', atCycleEnd: true })}
          >
            {t('subscriptions.actions.cancelAtCycleEnd')}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onAction({ type: 'cancel', atCycleEnd: false })}
          >
            {t('subscriptions.actions.cancelImmediately')}
          </Button>
        )}
      </div>
    </>
  );
}

function getConfirmText(action: ConfirmAction | null, t: (key: string) => string) {
  if (!action) return { title: '', description: '' };
  const titleKey = `subscriptions.actions.${action.type}ConfirmTitle`;
  const descKey = `subscriptions.actions.${action.type}Confirm`;
  return { title: t(titleKey), description: t(descKey) };
}

function MonoValue({ value }: { value?: string | null }) {
  return value ? <span className="font-mono text-xs">{value}</span> : '\u2014';
}

function SubscriptionFields({
  subscription,
  t,
  formatDate,
  formatCurrency,
  onAction,
}: {
  subscription: SubscriptionNode;
  t: (key: string) => string;
  formatDate: (date: Date) => string;
  formatCurrency: (amount: number) => string;
  onAction: (action: ConfirmAction) => void;
}) {
  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-1 pt-4">
        <DetailRow label={t('subscriptions.detail.id')}>
          <span className="font-mono text-xs">{subscription.id}</span>
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.institute')}>
          {subscription.organization?.name}
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.plan')}>
          {subscription.plan?.name} &mdash; {formatCurrency((subscription.plan?.amount ?? 0) / 100)}
        </DetailRow>

        <Separator className="my-2" />

        <DetailRow label={t('subscriptions.detail.status')}>
          <Badge>{t(`subscriptions.statuses.${subscription.status}`)}</Badge>
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.providerSubscriptionId')}>
          <MonoValue value={subscription.providerSubscriptionId} />
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.providerCustomerId')}>
          <MonoValue value={subscription.providerCustomerId} />
        </DetailRow>

        <Separator className="my-2" />

        <DetailRow label={t('subscriptions.detail.currentPeriodStart')}>
          <OptionalValue value={subscription.currentPeriodStart} formatDate={formatDate} />
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.currentPeriodEnd')}>
          <OptionalValue value={subscription.currentPeriodEnd} formatDate={formatDate} />
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.canceledAt')}>
          <OptionalValue value={subscription.canceledAt} formatDate={formatDate} />
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.trialEndsAt')}>
          <OptionalValue value={subscription.trialEndsAt} formatDate={formatDate} />
        </DetailRow>
        <DetailRow label={t('subscriptions.detail.createdAt')}>
          {formatDate(new Date(subscription.createdAt))}
        </DetailRow>

        <ActionButtons subscription={subscription} onAction={onAction} t={t} />
      </div>
    </ScrollArea>
  );
}

async function executeAction(
  action: ConfirmAction,
  subscriptionId: string,
  mutations: {
    cancel: ReturnType<typeof useCancelSubscription>[0];
    pause: ReturnType<typeof usePauseSubscription>[0];
    resume: ReturnType<typeof useResumeSubscription>[0];
  },
) {
  if (action.type === 'cancel') {
    await mutations.cancel({
      variables: { input: { subscriptionId, atCycleEnd: action.atCycleEnd } },
    });
  } else if (action.type === 'pause') {
    await mutations.pause({ variables: { subscriptionId } });
  } else {
    await mutations.resume({ variables: { subscriptionId } });
  }
}

export function SubscriptionDetail({
  subscription,
  open,
  onOpenChange,
  t,
  formatDate,
  formatCurrency,
}: SubscriptionDetailProps) {
  const [cancelSubscription] = useCancelSubscription();
  const [pauseSubscription] = usePauseSubscription();
  const [resumeSubscription] = useResumeSubscription();
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null);

  if (!subscription) return null;

  const { title: confirmTitle, description: confirmDescription } = getConfirmText(confirmAction, t);

  const handleConfirm = async () => {
    if (!confirmAction) return;

    try {
      await executeAction(confirmAction, subscription.id, {
        cancel: cancelSubscription,
        pause: pauseSubscription,
        resume: resumeSubscription,
      });
      toast.success(t(`subscriptions.actions.${confirmAction.type}Success`));
      onOpenChange(false);
    } catch (err) {
      const key = `subscriptions.actions.${confirmAction.type}Error`;
      toast.error(t(key), { description: extractGraphQLError(err, t(key)) });
    } finally {
      setConfirmAction(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{t('subscriptions.detail.title')}</SheetTitle>
            <SheetDescription>{t('subscriptions.detail.description')}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            <SubscriptionFields
              subscription={subscription}
              t={t}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              onAction={setConfirmAction}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('subscriptions.actions.confirmCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {t('subscriptions.actions.confirmProceed')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
