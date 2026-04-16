'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import {
  Button,
  Calendar,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useAppForm,
} from '@roviq/ui';
import { parseISO } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../hooks/use-form-draft';
import { useCreateAcademicYear } from './use-academic-years';

const ISO_DATE_FORMAT = 'yyyy-MM-dd';
const DISPLAY_DATE_FORMAT = 'dd/MM/yyyy';
const LABEL_MAX_LENGTH = 50;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// [GYATP] Canonical academic-year label format: `YYYY-YY` (e.g. 2025-26).
const ACADEMIC_YEAR_LABEL_REGEX = /^\d{4}-\d{2}$/;

interface TermInput {
  label: string;
  startDate: string;
  endDate: string;
}

interface CreateYearForm {
  label: string;
  startDate: string;
  endDate: string;
  terms: TermInput[];
}

const EMPTY_FORM: CreateYearForm = {
  label: '',
  startDate: '',
  endDate: '',
  terms: [],
};

function buildSchema(t: ReturnType<typeof useTranslations>) {
  const termSchema = z.object({
    label: z.string().trim().min(1, t('termLabelRequired')),
    startDate: z
      .string()
      .min(1, t('termDateRequired'))
      .regex(ISO_DATE_REGEX, t('termDateRequired')),
    endDate: z.string().min(1, t('termDateRequired')).regex(ISO_DATE_REGEX, t('termDateRequired')),
  });

  return z
    .object({
      label: z
        .string()
        .trim()
        .min(1, t('labelRequired'))
        .max(LABEL_MAX_LENGTH)
        .regex(ACADEMIC_YEAR_LABEL_REGEX, t('labelFormatError')),
      startDate: z
        .string()
        .min(1, t('startDateRequired'))
        .regex(ISO_DATE_REGEX, t('startDateRequired')),
      endDate: z.string().min(1, t('endDateRequired')).regex(ISO_DATE_REGEX, t('endDateRequired')),
      terms: z.array(termSchema),
    })
    .refine((data) => data.startDate < data.endDate, {
      path: ['endDate'],
      message: t('errors.INVALID_DATE_RANGE'),
    });
}

export function CreateYearDialog() {
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');
  const { format: formatLocalized } = useFormatDate();
  const { createYear, loading } = useCreateAcademicYear();
  const [open, setOpen] = useState(false);

  const schema = buildSchema(t);

  const form = useAppForm({
    defaultValues: EMPTY_FORM,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await createYear({
          label: parsed.label.trim(),
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          termStructure: parsed.terms.length > 0 ? parsed.terms : undefined,
        });
        toast.success(t('created'));
        clearDraft();
        form.reset(EMPTY_FORM);
        setOpen(false);
      } catch (err) {
        const message = extractGraphQLError(err, t('errors.INVALID_DATE_RANGE'));
        if (/overlap/i.test(message)) {
          toast.error(t('errors.ACADEMIC_YEAR_OVERLAP'));
        } else if (/date/i.test(message)) {
          form.setFieldMeta('endDate', (prev) => ({
            ...prev,
            isTouched: true,
            errorMap: { ...prev.errorMap, onSubmit: t('errors.INVALID_DATE_RANGE') },
          }));
        } else {
          toast.error(message);
        }
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft<CreateYearForm>({
    key: 'academicYear:new',
    form,
    enabled: open,
  });

  // Mirror the original UX: surface the restored draft via a toast.info with
  // a discard action, instead of an inline banner. We fire it once per dialog
  // open so re-renders don't repeat the toast.
  const draftPromptedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      draftPromptedRef.current = false;
      return;
    }
    if (draftPromptedRef.current) return;
    if (!hasDraft) return;
    draftPromptedRef.current = true;
    restoreDraft();
    toast.info(t('draftRestoredTitle'), {
      description: t('draftRestoredDescription'),
      action: {
        label: t('discardDraft'),
        onClick: () => {
          discardDraft();
          form.reset(EMPTY_FORM);
        },
      },
    });
  }, [open, hasDraft, restoreDraft, discardDraft, form, t]);

  const resetAndClose = useCallback(() => {
    clearDraft();
    form.reset(EMPTY_FORM);
    setOpen(false);
  }, [clearDraft, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-2"
          title={t('newYear')}
          data-testid="academic-years-new-btn"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('newYear')}
        </Button>
      </DialogTrigger>
      <DialogContent
        data-testid="academic-years-create-dialog"
        className="max-w-lg max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t('newYear')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-5"
          noValidate
        >
          <FieldGroup>
            <form.AppField name="label">
              {(field) => (
                <field.TextField
                  label={t('label')}
                  description={`${t('labelDescription')} ${t('labelFormatHint')}`}
                  placeholder={t('labelPlaceholder')}
                  autoComplete="off"
                  maxLength={LABEL_MAX_LENGTH}
                  testId="academic-years-create-label-input"
                />
              )}
            </form.AppField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <form.Field name="startDate">
                {(field) => (
                  <DatePickerField
                    fieldName={field.name}
                    value={typeof field.state.value === 'string' ? field.state.value : ''}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    label={t('startDate')}
                    description={`${t('startDateDescription')} ${t('dateFormatHint')}`}
                    placeholder={t('dateFormatHint')}
                    formatLocalized={formatLocalized}
                    isTouched={field.state.meta.isTouched}
                    errors={collectMessages(field.state.meta.errors)}
                    testId="academic-years-create-start-date"
                  />
                )}
              </form.Field>

              <form.Field name="endDate">
                {(field) => (
                  <DatePickerField
                    fieldName={field.name}
                    value={typeof field.state.value === 'string' ? field.state.value : ''}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    label={t('endDate')}
                    description={`${t('endDateDescription')} ${t('dateFormatHint')}`}
                    placeholder={t('dateFormatHint')}
                    formatLocalized={formatLocalized}
                    isTouched={field.state.meta.isTouched}
                    errors={collectMessages(field.state.meta.errors)}
                    testId="academic-years-create-end-date"
                  />
                )}
              </form.Field>
            </div>
          </FieldGroup>

          <FieldSet>
            <div className="flex items-center justify-between gap-3">
              <FieldLegend variant="label">{t('termStructure')}</FieldLegend>
              <form.Field name="terms" mode="array">
                {(field) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.pushValue({ label: '', startDate: '', endDate: '' })}
                    className="gap-1.5 text-xs"
                    title={t('addTerm')}
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    {t('addTerm')}
                  </Button>
                )}
              </form.Field>
            </div>
            <FieldDescription>{t('termStructureDescription')}</FieldDescription>

            <form.Field name="terms" mode="array">
              {(field) => {
                const terms = (field.state.value ?? []) as TermInput[];
                if (terms.length === 0) {
                  return <p className="text-sm text-muted-foreground">{t('termsEmpty')}</p>;
                }
                return (
                  <FieldGroup>
                    {terms.map((_, index) => {
                      const termNumber = index + 1;
                      return (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional inside an editable array; index is stable enough for keyed re-renders.
                          key={index}
                          className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <form.AppField name={`terms[${index}].label`}>
                              {(termField) => (
                                <termField.TextField
                                  label={t('termLabelAria', { index: termNumber })}
                                  placeholder={t('termLabelPlaceholder')}
                                />
                              )}
                            </form.AppField>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => field.removeValue(index)}
                              className="size-8 p-0 text-muted-foreground hover:text-destructive"
                              title={t('removeTerm')}
                              aria-label={t('removeTermAria', { index: termNumber })}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <form.AppField name={`terms[${index}].startDate`}>
                              {(termField) => <termField.DateField label={t('termStart')} />}
                            </form.AppField>
                            <form.AppField name={`terms[${index}].endDate`}>
                              {(termField) => <termField.DateField label={t('termEnd')} />}
                            </form.AppField>
                          </div>
                        </div>
                      );
                    })}
                  </FieldGroup>
                );
              }}
            </form.Field>
          </FieldSet>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={loading}>
              {tCommon('cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                testId="academic-years-create-submit-btn"
                submittingLabel={t('creating')}
              >
                {t('createYear')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DatePickerFieldProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  label: string;
  description?: string;
  placeholder: string;
  formatLocalized: (date: Date, pattern: string) => string;
  isTouched: boolean;
  errors: string[];
  testId?: string;
}

function DatePickerField({
  fieldName,
  value,
  onChange,
  onBlur,
  label,
  description,
  placeholder,
  formatLocalized,
  isTouched,
  errors,
  testId,
}: DatePickerFieldProps) {
  const selected = value ? parseISO(value) : undefined;
  // Surface validation errors on first render when they arrive via `onChange` /
  // `onSubmit` validators — the DatePicker button is untouched at that point,
  // so gating on `isTouched` suppressed the submit-time "required" message
  // that tests (and real users) expect to see.
  const visibleErrors = isTouched || errors.length > 0 ? errors : [];
  const invalid = visibleErrors.length > 0;
  const descriptionId = `${fieldName}-description`;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={fieldName}>{label}</FieldLabel>
      <Popover onOpenChange={(open) => !open && onBlur()}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={fieldName}
            variant="outline"
            className="w-full justify-start text-start font-normal h-9"
            aria-invalid={invalid || undefined}
            aria-describedby={descriptionId}
            data-invalid={invalid || undefined}
            data-testid={testId}
          >
            <CalendarIcon className="me-2 size-4 text-muted-foreground" aria-hidden="true" />
            {selected ? (
              formatLocalized(selected, DISPLAY_DATE_FORMAT)
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(formatLocalized(date, ISO_DATE_FORMAT));
              }
            }}
          />
        </PopoverContent>
      </Popover>
      {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      {invalid && <FieldError errors={visibleErrors.map((message) => ({ message }))} />}

      {/* Hidden input mirrors the field value so screen readers can read the
          ISO date when the popover trigger only shows a localized display.
          Some Playwright assertions also rely on this for snapshotting. */}
      <Input type="hidden" name={fieldName} value={value} readOnly />
    </Field>
  );
}

function collectMessages(errors: ReadonlyArray<unknown>): string[] {
  const out: string[] = [];
  for (const err of errors) {
    if (err == null) continue;
    if (typeof err === 'string') {
      if (err.length > 0) out.push(err);
      continue;
    }
    if (typeof err === 'object' && 'message' in err) {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.length > 0) out.push(msg);
    }
  }
  return out;
}
