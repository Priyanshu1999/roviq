'use client';

import { Money } from '@roviq/domain';
import { extractGraphQLError, gql, useQuery } from '@roviq/graphql';
import type { Locale } from '@roviq/i18n';
import { useI18nField } from '@roviq/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldGroup,
  useAppForm,
} from '@roviq/ui';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useSubscriptionPlans } from '../plans/use-plans';

type InstitutesForAssignQuery = {
  resellerListInstitutes: {
    edges: Array<{ node: { id: string; name: Partial<Record<Locale, string>> } }>;
  };
};

import { useAssignPlan } from './use-subscriptions';

const INSTITUTES_QUERY = gql`
  query InstitutesForAssign {
    resellerListInstitutes {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

interface AssignPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignPlanDialog({ open, onOpenChange }: AssignPlanDialogProps) {
  const t = useTranslations('billing');
  const locale = useLocale();
  const ti = useI18nField();
  const { plans } = useSubscriptionPlans();
  const { data: institutesData } = useQuery<InstitutesForAssignQuery>(INSTITUTES_QUERY);
  const [assignPlan] = useAssignPlan();

  const activePlans = plans.filter((p) => p.status === 'ACTIVE');
  const institutes = institutesData?.resellerListInstitutes.edges.map((e) => e.node) ?? [];

  const assignSchema = React.useMemo(
    () =>
      z.object({
        tenantId: z.string().min(1, t('subscriptions.assign.instituteRequired')),
        planId: z.string().min(1, t('subscriptions.assign.planRequired')),
      }),
    [t],
  );

  type AssignFormValues = z.infer<typeof assignSchema>;

  const form = useAppForm({
    defaultValues: { tenantId: '', planId: '' } satisfies AssignFormValues,
    validators: { onChange: assignSchema, onSubmit: assignSchema },
    onSubmit: async ({ value }) => {
      const parsed = assignSchema.parse(value);
      try {
        const { data } = await assignPlan({
          variables: {
            input: {
              tenantId: parsed.tenantId,
              planId: parsed.planId,
            },
          },
        });
        const checkoutUrl = data?.assignPlanToInstitute?.checkoutUrl;
        if (checkoutUrl) {
          // Paid plan — redirect to payment gateway checkout
          window.open(checkoutUrl, '_blank');
          toast.success(t('subscriptions.assign.checkoutRedirect'));
        } else {
          // Free plan — no payment needed
          toast.success(t('subscriptions.assign.success'));
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(t('subscriptions.assign.error'), {
          description: extractGraphQLError(err, t('subscriptions.assign.error')),
        });
      }
    },
  });

  // Reset values when the dialog re-opens so a previously closed dialog
  // doesn't retain stale selections (matches the previous RHF reset effect).
  React.useEffect(() => {
    if (open) {
      form.reset({ tenantId: '', planId: '' });
    }
  }, [open, form]);

  const instituteOptions = institutes.map((inst) => ({
    value: inst.id,
    label: ti(inst.name),
  }));
  const planOptions = activePlans.map((plan) => {
    const priceLabel =
      Number(plan.amount) === 0
        ? t('subscriptions.assign.free')
        : `${Money.tryCreate(Number(plan.amount), plan.currency)?.format(locale) ?? '—'} / ${t(`plans.intervals.${plan.interval}`)}`;
    return {
      value: plan.id,
      label: (
        <div className="flex items-center gap-2">
          <span>{ti(plan.name)}</span>
          <span className="text-muted-foreground">{priceLabel}</span>
        </div>
      ),
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="billing-assign-plan-dialog" className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('subscriptions.assign.title')}</DialogTitle>
          <DialogDescription>{t('subscriptions.assign.description')}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.AppField name="tenantId">
              {(field) => (
                <field.SelectField
                  label={t('subscriptions.assign.institute')}
                  options={instituteOptions}
                  placeholder={t('subscriptions.assign.selectInstitute')}
                  optional={false}
                />
              )}
            </form.AppField>

            <form.AppField name="planId">
              {(field) => (
                <field.SelectField
                  label={t('subscriptions.assign.plan')}
                  options={planOptions}
                  placeholder={t('subscriptions.assign.selectPlan')}
                  optional={false}
                  testId="billing-assign-plan-select"
                />
              )}
            </form.AppField>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <form.AppForm>
              <form.SubmitButton submittingLabel={t('subscriptions.assign.assigning')}>
                {t('subscriptions.assign.assign')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
