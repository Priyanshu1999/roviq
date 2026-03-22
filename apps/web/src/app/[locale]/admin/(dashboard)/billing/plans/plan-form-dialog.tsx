'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { FeatureLimits } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema } from '@roviq/i18n';
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
  I18nInput,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type SubscriptionPlanNode, useCreatePlan, useUpdatePlan } from './use-plans';

function getFeatureLimits(
  plan: { featureLimits: Record<string, unknown> } | null | undefined,
): FeatureLimits {
  return (plan?.featureLimits ?? {}) as FeatureLimits;
}

const BILLING_INTERVALS = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: SubscriptionPlanNode | null;
}

export function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  const t = useTranslations('billing');
  const isEditing = !!plan;
  const [createPlan] = useCreatePlan();
  const [updatePlan] = useUpdatePlan();

  const planSchema = React.useMemo(
    () =>
      z.object({
        name: i18nTextSchema,
        description: z.record(z.string().min(2).max(5), z.string().max(500)).optional(),
        amount: z.number().nonnegative(t('plans.form.amountRequired')),
        billingInterval: z.enum(BILLING_INTERVALS),
        maxUsers: z.number().int().min(0).optional(),
        maxSections: z.number().int().min(0).optional(),
      }),
    [t],
  );

  type PlanFormValues = z.infer<typeof planSchema>;

  const planName = plan?.name as Record<string, string> | undefined;
  const planDescription = plan?.description as Record<string, string> | undefined;

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema) as Resolver<PlanFormValues>,
    defaultValues: {
      name: planName ?? { en: '' },
      description: planDescription ?? { en: '' },
      amount: plan ? plan.amount / 100 : 0,
      billingInterval: plan?.billingInterval ?? 'MONTHLY',
      maxUsers: getFeatureLimits(plan).maxUsers ?? undefined,
      maxSections: getFeatureLimits(plan).maxSections ?? undefined,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  React.useEffect(() => {
    if (open) {
      reset({
        name: planName ?? { en: '' },
        description: planDescription ?? { en: '' },
        amount: plan ? plan.amount / 100 : 0,
        billingInterval: plan?.billingInterval ?? 'MONTHLY',
        maxUsers: getFeatureLimits(plan).maxUsers ?? undefined,
        maxSections: getFeatureLimits(plan).maxSections ?? undefined,
      });
    }
  }, [open, plan, planName, planDescription, reset]);

  const onSubmit = async (values: PlanFormValues) => {
    const featureLimits: FeatureLimits = {};
    if (values.maxUsers != null) featureLimits.maxUsers = values.maxUsers;
    if (values.maxSections != null) featureLimits.maxSections = values.maxSections;

    try {
      if (isEditing && plan) {
        await updatePlan({
          variables: {
            id: plan.id,
            input: {
              name: values.name,
              description: values.description || undefined,
              amount: Math.round(values.amount * 100),
              billingInterval: values.billingInterval,
              featureLimits,
            },
          },
        });
        toast.success(t('plans.form.updateSuccess'));
      } else {
        await createPlan({
          variables: {
            input: {
              name: values.name,
              description: values.description || undefined,
              amount: Math.round(values.amount * 100),
              billingInterval: values.billingInterval,
              featureLimits,
            },
          },
        });
        toast.success(t('plans.form.createSuccess'));
      }
      onOpenChange(false);
    } catch (err) {
      const fallback = isEditing ? t('plans.form.updateError') : t('plans.form.createError');
      toast.error(fallback, { description: extractGraphQLError(err, fallback) });
    }
  };

  const billingInterval = watch('billingInterval');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('plans.editPlan') : t('plans.createPlan')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('plans.editPlan') : t('plans.createPlan')}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <I18nInput<PlanFormValues>
                name="name"
                label={t('plans.form.name')}
                required
                placeholder={t('plans.form.namePlaceholder')}
              />

              <I18nInput<PlanFormValues>
                name="description"
                label={t('plans.form.description')}
                placeholder={t('plans.form.descriptionPlaceholder')}
              />

              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!errors.amount}>
                  <FieldLabel htmlFor="amount">{t('plans.form.amount')}</FieldLabel>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('plans.form.amountPlaceholder')}
                    aria-invalid={!!errors.amount}
                    {...register('amount', { valueAsNumber: true })}
                  />
                  {errors.amount && <FieldError errors={[errors.amount]} />}
                </Field>

                <Field>
                  <FieldLabel>{t('plans.form.interval')}</FieldLabel>
                  <Select
                    value={billingInterval}
                    onValueChange={(v) =>
                      setValue('billingInterval', v as PlanFormValues['billingInterval'])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('plans.form.selectInterval')} />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_INTERVALS.map((interval) => (
                        <SelectItem key={interval} value={interval}>
                          {t(`plans.intervals.${interval}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="maxUsers">{t('plans.form.maxUsers')}</FieldLabel>
                  <Input
                    id="maxUsers"
                    type="number"
                    min="0"
                    {...register('maxUsers', { valueAsNumber: true })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="maxSections">{t('plans.form.maxSections')}</FieldLabel>
                  <Input
                    id="maxSections"
                    type="number"
                    min="0"
                    {...register('maxSections', { valueAsNumber: true })}
                  />
                </Field>
              </div>
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('plans.form.saving')}
                  </>
                ) : isEditing ? (
                  t('plans.form.saveChanges')
                ) : (
                  t('plans.form.createPlan')
                )}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
