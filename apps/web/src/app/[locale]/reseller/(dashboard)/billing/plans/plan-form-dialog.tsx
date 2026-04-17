'use client';

import type { FeatureLimits } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema, useFormatDate, useFormatNumber, zodValidator } from '@roviq/i18n';
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
  FieldGroup,
  FieldInfoPopover,
  FieldLabel,
  FieldLegend,
  FieldSet,
  I18nField,
  useAppForm,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../hooks/use-form-draft';
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
type BillingInterval = (typeof BILLING_INTERVALS)[number];

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
  amount: number | undefined;
  interval: BillingInterval;
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
      name: plan?.name ?? { en: '', hi: '' },
      code: '',
      description:
        plan?.description != null
          ? { en: '', hi: '', ...(plan.description as Record<string, string>) }
          : { en: '', hi: '' },
      amount: plan ? Number(plan.amount) / 100 : 0,
      interval: plan?.interval ?? 'MONTHLY',
      trialDays: plan?.trialDays ?? 0,
      sortOrder: plan?.sortOrder ?? undefined,
      maxStudents: entitlements.maxStudents ?? undefined,
      maxStaff: entitlements.maxStaff ?? undefined,
      maxStorageMb: entitlements.maxStorageMb ?? undefined,
    };
  }, [plan]);

  const form = useAppForm({
    defaultValues: buildDefaults(),
    validators: { onChange: zodValidator(planSchema), onSubmit: zodValidator(planSchema) },
    onSubmit: async ({ value }) => {
      // Re-parse to apply Zod transforms (i18nTextSchema strips empty locales)
      // and to fail fast with the same messages the live `onChange` validator
      // would have reported. `value` is already typed as the input shape so
      // the parse boundary keeps the wire format aligned with the resolver.
      const parsed = planSchema.parse(value);
      const entitlements: FeatureLimits = {
        ...DEFAULT_ENTITLEMENTS,
        maxStudents: parsed.maxStudents ?? null,
        maxStaff: parsed.maxStaff ?? null,
        maxStorageMb: parsed.maxStorageMb ?? null,
      };

      // [HVJED] Convert rupees → paise BIGINT at the wire boundary. Round to
      // the nearest integer paisa so 1.234 → 123 paise (₹1.23), preventing
      // float-precision drift from leaking into the persisted amount. The
      // GraphQL schema accepts BIGINT-as-string, so we serialise here.
      const amountPaise = String(Math.round(parsed.amount * 100));

      try {
        if (isEditing && plan) {
          await updatePlan({
            variables: {
              id: plan.id,
              input: {
                name: parsed.name,
                description: parsed.description || undefined,
                amount: amountPaise,
                interval: parsed.interval,
                trialDays: parsed.trialDays,
                sortOrder: parsed.sortOrder,
                entitlements: { ...entitlements },
                version: plan.version,
              },
            },
          });
          toast.success(t('plans.form.updateSuccess'));
        } else {
          const code =
            parsed.code?.trim() ||
            (parsed.name.en ?? '')
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, '_')
              .replace(/^_|_$/g, '')
              .slice(0, 50) ||
            'PLAN';
          await createPlan({
            variables: {
              input: {
                name: parsed.name,
                code,
                description: parsed.description || undefined,
                amount: amountPaise,
                interval: parsed.interval,
                trialDays: parsed.trialDays,
                sortOrder: parsed.sortOrder,
                entitlements: { ...entitlements },
              },
            },
          });
          toast.success(t('plans.form.createSuccess'));
        }
        clearDraft();
        onOpenChange(false);
      } catch (err) {
        const fallback = isEditing ? t('plans.form.updateError') : t('plans.form.createError');
        toast.error(fallback, { description: extractGraphQLError(err, fallback) });
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft<PlanFormValues>({
    key: `reseller-plan-form:${plan?.id ?? 'new'}`,
    form,
    enabled: open,
  });

  // Reset to fresh defaults whenever the dialog opens or the underlying plan
  // identity changes — mirrors the original RHF effect. `keepDefaultValues:
  // true` works around tanstack/form#1798 where a follow-up reconcile pass
  // would otherwise revert this reset.
  React.useEffect(() => {
    if (!open) return;
    form.reset(buildDefaults(), { keepDefaultValues: true });
  }, [open, buildDefaults, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="billing-create-plan-dialog"
        className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? t('plans.editPlan') : t('plans.createPlan')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('plans.form.editDescription') : t('plans.form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        {hasDraft && (
          <output
            aria-live="polite"
            className="mt-2 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <span>{t('plans.form.draftAvailable')}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={restoreDraft}
                data-testid="billing-plan-draft-restore-btn"
              >
                {t('plans.form.draftRestore')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={discardDraft}
                data-testid="billing-plan-draft-discard-btn"
              >
                {t('plans.form.draftDiscard')}
              </Button>
            </div>
          </output>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            {/* ---------------- Basic Information ------------------ */}
            <FieldSet data-testid="billing-plan-section-basic">
              <FieldLegend>{t('plans.form.sectionBasic')}</FieldLegend>

              <I18nField
                form={form}
                name="name"
                label={t('plans.form.name')}
                placeholder={t('plans.form.namePlaceholder')}
                testId="billing-plan-name-input"
              />

              {isEditing ? (
                <Field>
                  <FieldLabel>
                    {t('plans.form.code')}
                    <FieldInfoPopover
                      title={t('plans.form.fieldHelp.codeTitle')}
                      data-testid="billing-plan-code-info"
                    >
                      <p>{t('plans.form.fieldHelp.codeBody')}</p>
                      <p>
                        <em>{t('plans.form.fieldHelp.codeExample')}</em>
                      </p>
                    </FieldInfoPopover>
                  </FieldLabel>
                  <p className="text-sm font-mono">{plan?.id}</p>
                  <FieldDescription>{t('plans.form.codeReadOnlyHint')}</FieldDescription>
                </Field>
              ) : (
                <form.AppField name="code">
                  {(field) => (
                    <field.TextField
                      label={t('plans.form.code')}
                      description={t('plans.form.codeHint')}
                      placeholder={t('plans.form.codePlaceholder')}
                      testId="billing-plan-code-input"
                      errorTestId="billing-plan-code-error"
                      info={
                        <FieldInfoPopover
                          title={t('plans.form.fieldHelp.codeTitle')}
                          data-testid="billing-plan-code-info"
                        >
                          <p>{t('plans.form.fieldHelp.codeBody')}</p>
                          <p>
                            <em>{t('plans.form.fieldHelp.codeExample')}</em>
                          </p>
                        </FieldInfoPopover>
                      }
                    />
                  )}
                </form.AppField>
              )}

              <I18nField
                form={form}
                name="description"
                label={t('plans.form.description')}
                placeholder={t('plans.form.descriptionPlaceholder')}
                testId="billing-plan-description-input"
              />
            </FieldSet>

            {/* ---------------- Billing ---------------------------- */}
            <FieldSet data-testid="billing-plan-section-billing">
              <FieldLegend>{t('plans.form.sectionBilling')}</FieldLegend>

              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="amount">
                  {(field) => (
                    <field.MoneyField
                      label={t('plans.form.amount')}
                      info={
                        <FieldInfoPopover
                          title={t('plans.form.amountHelpAria')}
                          data-testid="billing-plan-amount-info"
                        >
                          <p>{t('plans.form.amountHelp')}</p>
                        </FieldInfoPopover>
                      }
                      description={t('plans.form.amountConstraint', {
                        max: currency(AMOUNT_MAX_RUPEES),
                      })}
                      placeholder={t('plans.form.amountPlaceholder')}
                      min={AMOUNT_MIN_RUPEES}
                      max={AMOUNT_MAX_RUPEES}
                      testId="billing-plan-amount-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="interval">
                  {(field) => (
                    <field.SelectField
                      label={t('plans.form.interval')}
                      description={t('plans.form.intervalHint')}
                      placeholder={t('plans.form.selectInterval')}
                      optional={false}
                      options={BILLING_INTERVALS.map((interval) => ({
                        value: interval,
                        label: t(`plans.intervals.${interval}`),
                      }))}
                      testId="billing-plan-interval-select"
                      info={
                        <FieldInfoPopover
                          title={t('plans.form.fieldHelp.intervalTitle')}
                          data-testid="billing-plan-interval-info"
                        >
                          <p>{t('plans.form.fieldHelp.intervalBody')}</p>
                          <p>{t('plans.form.fieldHelp.intervalOptions')}</p>
                        </FieldInfoPopover>
                      }
                    />
                  )}
                </form.AppField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="trialDays">
                  {(field) => (
                    <field.NumberField
                      label={t('plans.form.trialDays')}
                      description={t('plans.form.trialDaysHint', { max: TRIAL_DAYS_MAX })}
                      min={0}
                      max={TRIAL_DAYS_MAX}
                      step={1}
                      testId="billing-plan-trial-days-input"
                      info={
                        <FieldInfoPopover
                          title={t('plans.form.fieldHelp.trialDaysTitle')}
                          data-testid="billing-plan-trial-days-info"
                        >
                          <p>{t('plans.form.fieldHelp.trialDaysBody')}</p>
                        </FieldInfoPopover>
                      }
                    />
                  )}
                </form.AppField>

                <form.AppField name="sortOrder">
                  {(field) => (
                    <field.NumberField
                      label={t('plans.form.sortOrder')}
                      description={t('plans.form.sortOrderHint')}
                      min={0}
                      max={9999}
                      step={1}
                      testId="billing-plan-sort-order-input"
                    />
                  )}
                </form.AppField>
              </div>
            </FieldSet>

            {/* ---------------- Capacity Limits -------------------- */}
            <FieldSet data-testid="billing-plan-section-limits">
              <FieldLegend className="flex items-center gap-2">
                {t('plans.form.sectionLimits')}
                <FieldInfoPopover
                  title={t('plans.form.fieldHelp.limitsTitle')}
                  data-testid="billing-plan-limits-info"
                >
                  <p>{t('plans.form.fieldHelp.limitsBody')}</p>
                  <p>
                    <em>{t('plans.form.fieldHelp.limitsExample')}</em>
                  </p>
                </FieldInfoPopover>
              </FieldLegend>
              <p className="text-xs text-muted-foreground">{t('plans.form.limitsHint')}</p>

              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="maxStudents">
                  {(field) => (
                    <field.NumberField
                      label={t('plans.form.maxStudents')}
                      description={t('plans.form.maxStudentsHint', {
                        max: formatNumber(MAX_STUDENTS_CEILING),
                      })}
                      min={1}
                      max={MAX_STUDENTS_CEILING}
                      step={1}
                      testId="billing-plan-max-students-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="maxStaff">
                  {(field) => (
                    <field.NumberField
                      label={t('plans.form.maxStaff')}
                      description={t('plans.form.maxStaffHint', {
                        max: formatNumber(MAX_STAFF_CEILING),
                      })}
                      min={1}
                      max={MAX_STAFF_CEILING}
                      step={1}
                      testId="billing-plan-max-staff-input"
                    />
                  )}
                </form.AppField>
              </div>

              <form.AppField name="maxStorageMb">
                {(field) => (
                  <field.NumberField
                    label={t('plans.form.maxStorageMb')}
                    description={t('plans.form.maxStorageMbHint')}
                    min={1}
                    max={MAX_STORAGE_MB_CEILING}
                    step={1}
                    testId="billing-plan-max-storage-input"
                  />
                )}
              </form.AppField>
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
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  data-testid="billing-plan-cancel-btn"
                >
                  {tCommon('cancel')}
                </Button>
              )}
            </form.Subscribe>
            <form.AppForm>
              <form.SubmitButton
                testId="billing-plan-submit-btn"
                submittingLabel={t('plans.form.saving')}
              >
                {isEditing ? t('plans.form.saveChanges') : t('plans.form.createPlan')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
