'use client';

import { extractGraphQLError, gql, useMutation } from '@roviq/graphql';
import { useFormatNumber, useI18nField } from '@roviq/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldInfoPopover,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { useSubscriptionPlans } from '../plans/use-plans';

const CHANGE_PLAN_MUTATION = gql`
  mutation ChangePlan($input: ChangePlanInput!) {
    changePlan(input: $input) { id status planId }
  }
`;

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  currentPlanId: string;
  currentPlanAmount: string;
  periodStart: string | null;
  periodEnd: string | null;
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  subscriptionId,
  currentPlanId,
  currentPlanAmount,
  periodStart,
  periodEnd,
}: ChangePlanDialogProps) {
  const t = useTranslations('billing');
  const { currency } = useFormatNumber();
  const ti = useI18nField();
  const { plans } = useSubscriptionPlans();
  const [changePlan] = useMutation(CHANGE_PLAN_MUTATION, { refetchQueries: ['Subscriptions'] });
  const [newPlanId, setNewPlanId] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const activePlans = plans.filter((p) => p.status === 'ACTIVE' && p.id !== currentPlanId);
  const selectedPlan = activePlans.find((p) => p.id === newPlanId);

  // Proration preview
  const now = Date.now();
  const start = periodStart ? new Date(periodStart).getTime() : now;
  const end = periodEnd ? new Date(periodEnd).getTime() : now;
  const totalPeriod = end - start;
  const remaining = Math.max(0, end - now);
  const fraction = totalPeriod > 0 ? remaining / totalPeriod : 0;

  const credit = Math.round(fraction * Number(currentPlanAmount));
  const charge = selectedPlan ? Math.round(fraction * Number(selectedPlan.amount)) : 0;
  const delta = charge - credit;

  const handleSubmit = async () => {
    if (!newPlanId) return;
    setIsSubmitting(true);
    try {
      await changePlan({
        variables: { input: { subscriptionId, newPlanId } },
      });
      toast.success(t('subscriptions.actions.changePlanSuccess'));
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGraphQLError(err, t('subscriptions.actions.changePlanError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('subscriptions.actions.changePlanTitle')}</DialogTitle>
          <DialogDescription>{t('subscriptions.actions.changePlanDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={newPlanId} onValueChange={setNewPlanId}>
            <SelectTrigger>
              <SelectValue placeholder={t('subscriptions.actions.selectNewPlan')} />
            </SelectTrigger>
            <SelectContent>
              {activePlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {ti(plan.name)} — {currency(Number(plan.amount) / 100)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPlan && (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('subscriptions.actions.prorationCredit')}
                </span>
                <span className="text-green-600">-{currency(credit / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('subscriptions.actions.prorationCharge')}
                </span>
                <span>{currency(charge / 100)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-1 font-medium">
                <span className="flex items-center gap-1.5">
                  {t('subscriptions.actions.prorationNet')}
                  <FieldInfoPopover
                    title={t('subscriptions.actions.fieldHelp.prorationTitle')}
                    data-testid={testIds.resellerBillingSubscriptions.changePlanProrationInfo}
                  >
                    <p>{t('subscriptions.actions.fieldHelp.prorationBody')}</p>
                  </FieldInfoPopover>
                </span>
                <span className={delta >= 0 ? 'text-orange-600' : 'text-green-600'}>
                  {delta >= 0 ? '+' : ''}
                  {currency(delta / 100)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('subscriptions.actions.confirmCancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!newPlanId || isSubmitting}>
            {isSubmitting
              ? t('subscriptions.actions.executing')
              : t('subscriptions.actions.confirmProceed')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
