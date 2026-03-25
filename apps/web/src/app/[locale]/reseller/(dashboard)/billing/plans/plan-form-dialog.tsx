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

const DEFAULT_ENTITLEMENTS: FeatureLimits = {
  maxStudents: null,
  maxStaff: null,
  maxStorageMb: null,
  auditLogRetentionDays: 90,
  features: [],
};

function getEntitlements(
  plan: { entitlements: Record<string, unknown> } | null | undefined,
): FeatureLimits {
  return { ...DEFAULT_ENTITLEMENTS, ...(plan?.entitlements as Partial<FeatureLimits>) };
}

const BILLING_INTERVALS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const;

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
        code: z.string().min(1).max(50).optional(),
        description: z.record(z.string().min(2).max(5), z.string().max(500)).optional(),
        amount: z.number().nonnegative(t('plans.form.amountRequired')),
        interval: z.enum(BILLING_INTERVALS),
        /** Number of free trial days before billing starts (0 = no trial) */
        trialDays: z.number().int().min(0).optional(),
        /** Display order in plan listing — lower numbers appear first */
        sortOrder: z.number().int().optional(),
        maxStudents: z.number().int().min(0).optional(),
        maxStaff: z.number().int().min(0).optional(),
        /** Maximum file storage in MB this plan allows */
        maxStorageMb: z.number().int().min(0).optional(),
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
      code: '',
      description: planDescription ?? { en: '' },
      amount: plan ? Number(plan.amount) / 100 : 0,
      interval: plan?.interval ?? 'MONTHLY',
      trialDays: plan?.trialDays ?? 0,
      sortOrder: plan?.sortOrder ?? undefined,
      maxStudents: getEntitlements(plan).maxStudents ?? undefined,
      maxStaff: getEntitlements(plan).maxStaff ?? undefined,
      maxStorageMb: getEntitlements(plan).maxStorageMb ?? undefined,
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
        code: '',
        description: planDescription ?? { en: '' },
        amount: plan ? Number(plan.amount) / 100 : 0,
        interval: plan?.interval ?? 'MONTHLY',
        trialDays: plan?.trialDays ?? 0,
        sortOrder: plan?.sortOrder ?? undefined,
        maxStudents: getEntitlements(plan).maxStudents ?? undefined,
        maxStaff: getEntitlements(plan).maxStaff ?? undefined,
        maxStorageMb: getEntitlements(plan).maxStorageMb ?? undefined,
      });
    }
  }, [open, plan, planName, planDescription, reset]);

  const onSubmit = async (values: PlanFormValues) => {
    const entitlements: FeatureLimits = {
      ...DEFAULT_ENTITLEMENTS,
      maxStudents: values.maxStudents ?? null,
      maxStaff: values.maxStaff ?? null,
      maxStorageMb: values.maxStorageMb ?? null,
    };

    try {
      if (isEditing && plan) {
        await updatePlan({
          variables: {
            id: plan.id,
            input: {
              name: values.name,
              description: values.description || undefined,
              amount: String(Math.round(values.amount * 100)),
              interval: values.interval,
              trialDays: values.trialDays,
              sortOrder: values.sortOrder,
              entitlements: { ...entitlements },
              version: plan.version,
            },
          },
        });
        toast.success(t('plans.form.updateSuccess'));
      } else {
        const code =
          values.code ||
          (values.name.en ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50) ||
          'plan';
        await createPlan({
          variables: {
            input: {
              name: values.name,
              code,
              description: values.description || undefined,
              amount: String(Math.round(values.amount * 100)),
              interval: values.interval,
              trialDays: values.trialDays,
              sortOrder: values.sortOrder,
              entitlements: { ...entitlements },
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

  const currentInterval = watch('interval');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('plans.editPlan') : t('plans.createPlan')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('plans.form.editDescription') : t('plans.form.createDescription')}
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

              {!isEditing && (
                <Field data-invalid={!!errors.code}>
                  <FieldLabel htmlFor="code">{t('plans.form.code')}</FieldLabel>
                  <Input
                    id="code"
                    placeholder={t('plans.form.codePlaceholder')}
                    aria-invalid={!!errors.code}
                    {...register('code')}
                  />
                  {errors.code && <FieldError errors={[errors.code]} />}
                </Field>
              )}

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
                    value={currentInterval}
                    onValueChange={(v) => setValue('interval', v as PlanFormValues['interval'])}
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
                <Field data-invalid={!!errors.trialDays}>
                  <FieldLabel htmlFor="trialDays">{t('plans.form.trialDays')}</FieldLabel>
                  <Input
                    id="trialDays"
                    type="number"
                    min="0"
                    aria-invalid={!!errors.trialDays}
                    {...register('trialDays', { valueAsNumber: true })}
                  />
                  {errors.trialDays && <FieldError errors={[errors.trialDays]} />}
                </Field>
                <Field data-invalid={!!errors.sortOrder}>
                  <FieldLabel htmlFor="sortOrder">{t('plans.form.sortOrder')}</FieldLabel>
                  <Input
                    id="sortOrder"
                    type="number"
                    aria-invalid={!!errors.sortOrder}
                    {...register('sortOrder', { valueAsNumber: true })}
                  />
                  {errors.sortOrder && <FieldError errors={[errors.sortOrder]} />}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="maxStudents">{t('plans.form.maxStudents')}</FieldLabel>
                  <Input
                    id="maxStudents"
                    type="number"
                    min="0"
                    {...register('maxStudents', { valueAsNumber: true })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="maxStaff">{t('plans.form.maxStaff')}</FieldLabel>
                  <Input
                    id="maxStaff"
                    type="number"
                    min="0"
                    {...register('maxStaff', { valueAsNumber: true })}
                  />
                </Field>
              </div>

              <Field data-invalid={!!errors.maxStorageMb}>
                <FieldLabel htmlFor="maxStorageMb">{t('plans.form.maxStorageMb')}</FieldLabel>
                <Input
                  id="maxStorageMb"
                  type="number"
                  min="0"
                  aria-invalid={!!errors.maxStorageMb}
                  {...register('maxStorageMb', { valueAsNumber: true })}
                />
                {errors.maxStorageMb && <FieldError errors={[errors.maxStorageMb]} />}
              </Field>
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
