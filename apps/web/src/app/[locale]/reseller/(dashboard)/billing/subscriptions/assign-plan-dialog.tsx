'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Money } from '@roviq/domain';
import { extractGraphQLError, gql, useQuery } from '@roviq/graphql';
import type { Locale } from '@roviq/i18n';
import { useI18nField } from '@roviq/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
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

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      tenantId: '',
      planId: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ tenantId: '', planId: '' });
    }
  }, [open, reset]);

  const onSubmit = async (values: AssignFormValues) => {
    try {
      const { data } = await assignPlan({
        variables: {
          input: {
            tenantId: values.tenantId,
            planId: values.planId,
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
  };

  const tenantId = watch('tenantId');
  const planId = watch('planId');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('subscriptions.assign.title')}</DialogTitle>
          <DialogDescription>{t('subscriptions.assign.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.tenantId}>
              <FieldLabel>{t('subscriptions.assign.institute')}</FieldLabel>
              <Select value={tenantId} onValueChange={(v) => setValue('tenantId', v)}>
                <SelectTrigger
                  aria-label={t('subscriptions.assign.institute')}
                  aria-invalid={!!errors.tenantId}
                >
                  <SelectValue placeholder={t('subscriptions.assign.selectInstitute')} />
                </SelectTrigger>
                <SelectContent>
                  {institutes.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {ti(inst.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tenantId && <FieldError errors={[errors.tenantId]} />}
            </Field>

            <Field data-invalid={!!errors.planId}>
              <FieldLabel>{t('subscriptions.assign.plan')}</FieldLabel>
              <Select value={planId} onValueChange={(v) => setValue('planId', v)}>
                <SelectTrigger
                  aria-label={t('subscriptions.assign.plan')}
                  aria-invalid={!!errors.planId}
                >
                  <SelectValue placeholder={t('subscriptions.assign.selectPlan')} />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center gap-2">
                        <span>{ti(plan.name)}</span>
                        <span className="text-muted-foreground">
                          {Number(plan.amount) === 0
                            ? t('subscriptions.assign.free')
                            : `${Money.tryCreate(Number(plan.amount), plan.currency)?.format(locale) ?? '—'} / ${t(`plans.intervals.${plan.interval}`)}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.planId && <FieldError errors={[errors.planId]} />}
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('subscriptions.assign.assigning')}
                </>
              ) : (
                t('subscriptions.assign.assign')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
