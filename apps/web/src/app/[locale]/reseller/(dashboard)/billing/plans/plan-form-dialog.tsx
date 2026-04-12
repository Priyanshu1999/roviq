'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { FeatureLimits } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema, useFormatDate, useFormatNumber } from '@roviq/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  I18nInput,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { HelpCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Controller, FormProvider, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { type SubscriptionPlanNode, useCreatePlan, useUpdatePlan } from './use-plans';

/**
 * Hard limits for monetary amount field.
 * Amount is entered in rupees in the UI, stored as BIGINT paise in the backend.
 * 10,00,00,000 (10 crore) rupees is a deliberately generous ceiling to avoid
 * accidental typos creating absurd plans.
 */
const AMOUNT_MIN_RUPEES = 0;
const AMOUNT_MAX_RUPEES = 100000000; // ₹10 Cr

/** Max reasonable trial window. 365 days = 1 academic year. */
const TRIAL_DAYS_MAX = 365;

/** Indian numbering ceilings that cover the largest real institutes. */
const MAX_STUDENTS_CEILING = 100000;
const MAX_STAFF_CEILING = 10000;
/** 1 TB expressed in MB — well beyond any single-institute realistic limit. */
const MAX_STORAGE_MB_CEILING = 1024 * 1024;

const DEFAULT_ENTITLEMENTS: FeatureLimits = {
  maxStudents: null,
  maxStaff: null,
  maxStorageMb: null,
  auditLogRetentionDays: 90,
  features: [],
};

const BILLING_INTERVALS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const;

type PlanEntitlementsShape = {
  maxStudents: number | null;
  maxStaff: number | null;
  maxStorageMb: number | null;
};

/**
 * Safely extract the three numeric entitlement fields from an unknown
 * `Record<string, unknown>` without using `any` / `as unknown` casts.
 */
function readEntitlements(
  source: Record<string, unknown> | null | undefined,
): PlanEntitlementsShape {
  const read = (key: string): number | null => {
    const value = source?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  return {
    maxStudents: read('maxStudents'),
    maxStaff: read('maxStaff'),
    maxStorageMb: read('maxStorageMb'),
  };
}

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: SubscriptionPlanNode | null;
}

interface PlanFormValues {
  name: Record<string, string>;
  code?: string;
  description?: Record<string, string>;
  /** Amount in RUPEES as entered by the user. Converted to paise on submit. */
  amount: number;
  interval: (typeof BILLING_INTERVALS)[number];
  trialDays?: number;
  sortOrder?: number;
  maxStudents?: number;
  maxStaff?: number;
  maxStorageMb?: number;
}

export function PlanFormDialog({ open, onOpenChange, plan }: PlanFormDialogProps) {
  const t = useTranslations('billing');
  const tCommon = useTranslations('common');
  const isEditing = !!plan;
  const [createPlan] = useCreatePlan();
  const [updatePlan] = useUpdatePlan();
  const { currency, format: formatNumber } = useFormatNumber();
  const { format: formatDate } = useFormatDate();

  const draftKey = React.useMemo(
    () => `roviq:draft:reseller-plan-form:${plan?.id ?? 'new'}`,
    [plan?.id],
  );

  const planSchema = React.useMemo(
    () =>
      z.object({
        name: i18nTextSchema,
        code: z
          .string()
          .trim()
          .min(1, t('plans.form.codeRequired'))
          .max(50, t('plans.form.codeMaxLength'))
          .regex(/^[A-Z0-9_-]+$/, t('plans.form.codeFormat'))
          .optional(),
        description: z.record(z.string().min(2).max(5), z.string().max(500)).optional(),
        amount: z
          .number({ error: t('plans.form.amountRequired') })
          .min(AMOUNT_MIN_RUPEES, t('plans.form.amountRequired'))
          .max(AMOUNT_MAX_RUPEES, t('plans.form.amountMaxExceeded')),
        interval: z.enum(BILLING_INTERVALS),
        trialDays: z
          .number()
          .int()
          .min(0)
          .max(TRIAL_DAYS_MAX, t('plans.form.trialDaysMaxExceeded'))
          .optional(),
        sortOrder: z.number().int().min(0).max(9999).optional(),
        maxStudents: z.number().int().min(1).max(MAX_STUDENTS_CEILING).optional(),
        maxStaff: z.number().int().min(1).max(MAX_STAFF_CEILING).optional(),
        maxStorageMb: z.number().int().min(1).max(MAX_STORAGE_MB_CEILING).optional(),
      }),
    [t],
  );

  // Derive all plan-dependent defaults inside the callback so its identity is
  // only tied to `plan` itself. Previously, intermediate `planName` /
  // `planDescription` / `planEntitlements` objects were recomputed on every
  // render, changing `buildDefaults`'s identity, which re-triggered the
  // open-effect below and caused "Maximum update depth exceeded".
  const buildDefaults = React.useCallback((): PlanFormValues => {
    const entitlements = readEntitlements(plan?.entitlements ?? null);
    return {
      name: plan?.name ?? { en: '' },
      code: '',
      description: plan?.description != null ? plan.description : { en: '' },
      amount: plan ? Number(plan.amount) / 100 : 0,
      interval: plan?.interval ?? 'MONTHLY',
      trialDays: plan?.trialDays ?? 0,
      sortOrder: plan?.sortOrder ?? undefined,
      maxStudents: entitlements.maxStudents ?? undefined,
      maxStaff: entitlements.maxStaff ?? undefined,
      maxStorageMb: entitlements.maxStorageMb ?? undefined,
    };
  }, [plan]);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema) as Resolver<PlanFormValues>,
    mode: 'onBlur',
    defaultValues: buildDefaults(),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  // ---- Draft auto-save (HUPGP) -------------------------------------------------
  const [draftRestoreAvailable, setDraftRestoreAvailable] = React.useState(false);

  // On open: reset form + detect saved draft
  React.useEffect(() => {
    if (!open) return;
    reset(buildDefaults());
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
      setDraftRestoreAvailable(raw !== null);
    } catch {
      setDraftRestoreAvailable(false);
    }
  }, [open, reset, buildDefaults, draftKey]);

  // Persist to localStorage every 30s and on dirty changes
  React.useEffect(() => {
    if (!open || !isDirty) return;
    const persist = () => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(form.getValues()));
      } catch {
        /* quota or private mode — ignore */
      }
    };
    persist();
    const handle = window.setInterval(persist, 30_000);
    return () => window.clearInterval(handle);
  }, [open, isDirty, draftKey, form]);

  const restoreDraft = () => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        reset({ ...buildDefaults(), ...(parsed as Partial<PlanFormValues>) });
      }
      setDraftRestoreAvailable(false);
    } catch {
      toast.error(t('plans.form.draftRestoreFailed'));
    }
  };

  const discardDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setDraftRestoreAvailable(false);
  };

  // ---- Submit -----------------------------------------------------------------
  const onSubmit = async (values: PlanFormValues) => {
    const entitlements: FeatureLimits = {
      ...DEFAULT_ENTITLEMENTS,
      maxStudents: values.maxStudents ?? null,
      maxStaff: values.maxStaff ?? null,
      maxStorageMb: values.maxStorageMb ?? null,
    };

    const amountPaise = String(Math.round(values.amount * 100));

    try {
      if (isEditing && plan) {
        await updatePlan({
          variables: {
            id: plan.id,
            input: {
              name: values.name,
              description: values.description || undefined,
              amount: amountPaise,
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
          values.code?.trim() ||
          (values.name.en ?? '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 50) ||
          'PLAN';
        await createPlan({
          variables: {
            input: {
              name: values.name,
              code,
              description: values.description || undefined,
              amount: amountPaise,
              interval: values.interval,
              trialDays: values.trialDays,
              sortOrder: values.sortOrder,
              entitlements: { ...entitlements },
            },
          },
        });
        toast.success(t('plans.form.createSuccess'));
      }
      discardDraft();
      onOpenChange(false);
    } catch (err) {
      const fallback = isEditing ? t('plans.form.updateError') : t('plans.form.createError');
      toast.error(fallback, { description: extractGraphQLError(err, fallback) });
    }
  };

  const currentInterval = watch('interval');
  const watchedAmount = watch('amount');
  const amountPreview = Number.isFinite(watchedAmount) && watchedAmount > 0 ? watchedAmount : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-test-id="billing-create-plan-dialog"
        className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? t('plans.editPlan') : t('plans.createPlan')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('plans.form.editDescription') : t('plans.form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        {draftRestoreAvailable && (
          <output
            aria-live="polite"
            className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <span>{t('plans.form.draftAvailable')}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={restoreDraft}>
                {t('plans.form.draftRestore')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
                {t('plans.form.draftDiscard')}
              </Button>
            </div>
          </output>
        )}

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              {/* ---------------- Basic Information ------------------ */}
              <FieldSet data-test-id="billing-plan-section-basic">
                <FieldLegend>{t('plans.form.sectionBasic')}</FieldLegend>

                <I18nInput<PlanFormValues>
                  name="name"
                  label={t('plans.form.name')}
                  required
                  placeholder={t('plans.form.namePlaceholder')}
                />

                {isEditing ? (
                  <Field>
                    <FieldLabel>{t('plans.form.code')}</FieldLabel>
                    <p className="text-sm font-mono">{plan?.id}</p>
                    <FieldDescription>{t('plans.form.codeReadOnlyHint')}</FieldDescription>
                  </Field>
                ) : (
                  <Field data-invalid={!!errors.code}>
                    <FieldLabel htmlFor="code">{t('plans.form.code')}</FieldLabel>
                    <Input
                      id="code"
                      placeholder={t('plans.form.codePlaceholder')}
                      aria-invalid={!!errors.code}
                      autoCapitalize="characters"
                      {...register('code')}
                    />
                    <FieldDescription>{t('plans.form.codeHint')}</FieldDescription>
                    {errors.code && <FieldError errors={[errors.code]} />}
                  </Field>
                )}

                <I18nInput<PlanFormValues>
                  name="description"
                  label={t('plans.form.description')}
                  placeholder={t('plans.form.descriptionPlaceholder')}
                />
              </FieldSet>

              {/* ---------------- Billing ---------------------------- */}
              <FieldSet data-test-id="billing-plan-section-billing">
                <FieldLegend>{t('plans.form.sectionBilling')}</FieldLegend>

                <div className="grid grid-cols-2 gap-4">
                  <Field data-invalid={!!errors.amount}>
                    <FieldLabel htmlFor="amount">
                      <span className="inline-flex items-center gap-1">
                        {t('plans.form.amount')}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              aria-label={t('plans.form.amountHelpAria')}
                              className="text-muted-foreground hover:text-foreground"
                              title={t('plans.form.amountHelpAria')}
                            >
                              <HelpCircle className="size-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="text-sm" side="top">
                            {t('plans.form.amountHelp')}
                          </PopoverContent>
                        </Popover>
                      </span>
                    </FieldLabel>
                    <Input
                      id="amount"
                      data-test-id="billing-plan-amount-input"
                      type="number"
                      inputMode="decimal"
                      min={AMOUNT_MIN_RUPEES}
                      max={AMOUNT_MAX_RUPEES}
                      step="0.01"
                      placeholder={t('plans.form.amountPlaceholder')}
                      aria-invalid={!!errors.amount}
                      {...register('amount', { valueAsNumber: true })}
                    />
                    <FieldDescription data-test-id="billing-plan-price-display">
                      {amountPreview > 0
                        ? t('plans.form.amountPreview', {
                            value: currency(amountPreview),
                          })
                        : t('plans.form.amountConstraint', {
                            max: currency(AMOUNT_MAX_RUPEES),
                          })}
                    </FieldDescription>
                    {errors.amount && <FieldError errors={[errors.amount]} />}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="interval">{t('plans.form.interval')}</FieldLabel>
                    <Select
                      value={currentInterval}
                      onValueChange={(v) => setValue('interval', v as PlanFormValues['interval'])}
                    >
                      <SelectTrigger id="interval">
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
                    <FieldDescription>{t('plans.form.intervalHint')}</FieldDescription>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field data-invalid={!!errors.trialDays}>
                    <FieldLabel htmlFor="trialDays">{t('plans.form.trialDays')}</FieldLabel>
                    <Input
                      id="trialDays"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={TRIAL_DAYS_MAX}
                      step={1}
                      aria-invalid={!!errors.trialDays}
                      {...register('trialDays', { valueAsNumber: true })}
                    />
                    <FieldDescription>
                      {t('plans.form.trialDaysHint', { max: TRIAL_DAYS_MAX })}
                    </FieldDescription>
                    {errors.trialDays && <FieldError errors={[errors.trialDays]} />}
                  </Field>

                  <Field data-invalid={!!errors.sortOrder}>
                    <FieldLabel htmlFor="sortOrder">{t('plans.form.sortOrder')}</FieldLabel>
                    <Input
                      id="sortOrder"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={9999}
                      step={1}
                      aria-invalid={!!errors.sortOrder}
                      {...register('sortOrder', {
                        setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                      })}
                    />
                    <FieldDescription>{t('plans.form.sortOrderHint')}</FieldDescription>
                    {errors.sortOrder && <FieldError errors={[errors.sortOrder]} />}
                  </Field>
                </div>
              </FieldSet>

              {/* ---------------- Capacity Limits -------------------- */}
              <FieldSet data-test-id="billing-plan-section-limits">
                <FieldLegend>{t('plans.form.sectionLimits')}</FieldLegend>
                <p className="text-xs text-muted-foreground">{t('plans.form.limitsHint')}</p>

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    control={control}
                    name="maxStudents"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="maxStudents">{t('plans.form.maxStudents')}</FieldLabel>
                        <Input
                          id="maxStudents"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_STUDENTS_CEILING}
                          step={1}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber;
                            field.onChange(Number.isNaN(v) ? undefined : v);
                          }}
                          onBlur={field.onBlur}
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldDescription>
                          {t('plans.form.maxStudentsHint', {
                            max: formatNumber(MAX_STUDENTS_CEILING),
                          })}
                        </FieldDescription>
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    control={control}
                    name="maxStaff"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="maxStaff">{t('plans.form.maxStaff')}</FieldLabel>
                        <Input
                          id="maxStaff"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_STAFF_CEILING}
                          step={1}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber;
                            field.onChange(Number.isNaN(v) ? undefined : v);
                          }}
                          onBlur={field.onBlur}
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldDescription>
                          {t('plans.form.maxStaffHint', { max: formatNumber(MAX_STAFF_CEILING) })}
                        </FieldDescription>
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>

                <Controller
                  control={control}
                  name="maxStorageMb"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="maxStorageMb">{t('plans.form.maxStorageMb')}</FieldLabel>
                      <Input
                        id="maxStorageMb"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_STORAGE_MB_CEILING}
                        step={1}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.valueAsNumber;
                          field.onChange(Number.isNaN(v) ? undefined : v);
                        }}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>{t('plans.form.maxStorageMbHint')}</FieldDescription>
                      {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldSet>

              {/* ---------------- Edit mode metadata (FVOLK) --------- */}
              {isEditing && plan && (
                <FieldSet>
                  <FieldLegend>{t('plans.form.sectionMetadata')}</FieldLegend>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">{t('plans.form.metaCreatedAt')}</dt>
                    <dd>{formatDate(new Date(plan.createdAt), 'dd/MM/yyyy HH:mm')}</dd>
                    <dt className="text-muted-foreground">{t('plans.form.metaUpdatedAt')}</dt>
                    <dd>{formatDate(new Date(plan.updatedAt), 'dd/MM/yyyy HH:mm')}</dd>
                    <dt className="text-muted-foreground">{t('plans.form.metaVersion')}</dt>
                    <dd>{plan.version}</dd>
                    <dt className="text-muted-foreground">{t('plans.form.metaStatus')}</dt>
                    <dd>{t(`plans.statuses.${plan.status}`)}</dd>
                  </dl>
                </FieldSet>
              )}
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                data-test-id="billing-plan-submit-btn"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
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
