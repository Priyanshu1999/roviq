'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { FeatureLimits } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';

function getFeatureLimits(
  plan: { featureLimits: Record<string, unknown> } | null | undefined,
): FeatureLimits {
  return (plan?.featureLimits ?? {}) as FeatureLimits;
}

import {
  Button,
  Checkbox,
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type SubscriptionPlanNode, useCreatePlan, useUpdatePlan } from './use-plans';

const BILLING_INTERVALS = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: SubscriptionPlanNode | null;
  t: (key: string) => string;
}

export function PlanFormDialog({ open, onOpenChange, plan, t }: PlanFormDialogProps) {
  const isEditing = !!plan;
  const [createPlan] = useCreatePlan();
  const [updatePlan] = useUpdatePlan();

  const planSchema = React.useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('plans.form.nameRequired')),
        description: z.string().optional(),
        amount: z.number().nonnegative(t('plans.form.amountRequired')),
        billingInterval: z.enum(BILLING_INTERVALS),
        maxUsers: z.number().int().min(0).optional(),
        maxSections: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      }),
    [t],
  );

  type PlanFormValues = z.infer<typeof planSchema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema) as Resolver<PlanFormValues>,
    defaultValues: {
      name: plan?.name ?? '',
      description: plan?.description ?? '',
      amount: plan ? plan.amount / 100 : 0,
      billingInterval: plan?.billingInterval ?? 'MONTHLY',
      maxUsers: getFeatureLimits(plan).maxUsers ?? undefined,
      maxSections: getFeatureLimits(plan).maxSections ?? undefined,
      isActive: plan?.isActive ?? true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: plan?.name ?? '',
        description: plan?.description ?? '',
        amount: plan ? plan.amount / 100 : 0,
        billingInterval: plan?.billingInterval ?? 'MONTHLY',
        maxUsers: getFeatureLimits(plan).maxUsers ?? undefined,
        maxSections: getFeatureLimits(plan).maxSections ?? undefined,
        isActive: plan?.isActive ?? true,
      });
    }
  }, [open, plan, reset]);

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
              isActive: values.isActive,
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

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">{t('plans.form.name')}</FieldLabel>
              <Input
                id="name"
                placeholder={t('plans.form.namePlaceholder')}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              {errors.name && <FieldError errors={[errors.name]} />}
            </Field>

            <Field>
              <FieldLabel htmlFor="description">{t('plans.form.description')}</FieldLabel>
              <Input
                id="description"
                placeholder={t('plans.form.descriptionPlaceholder')}
                {...register('description')}
              />
            </Field>

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

            {isEditing && (
              <Field orientation="horizontal">
                <Checkbox
                  id="isActive"
                  checked={watch('isActive')}
                  onCheckedChange={(checked) => setValue('isActive', !!checked)}
                />
                <FieldLabel htmlFor="isActive">{t('plans.form.isActive')}</FieldLabel>
              </Field>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('plans.form.saving')}
                </>
              ) : (
                t('plans.form.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
