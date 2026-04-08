'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
} from '@roviq/ui';
import { format as formatDateFn, parseISO } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateAcademicYear } from './use-academic-years';

const DRAFT_STORAGE_KEY = 'roviq:draft:academicYear:new';
const DRAFT_AUTOSAVE_INTERVAL_MS = 30_000;
const ISO_DATE_FORMAT = 'yyyy-MM-dd';
const DISPLAY_DATE_FORMAT = 'dd/MM/yyyy';
const LABEL_MAX_LENGTH = 50;

const termSchema = z.object({
  label: z.string().trim().min(1, 'termLabelRequired'),
  startDate: z.string().min(1, 'termDateRequired'),
  endDate: z.string().min(1, 'termDateRequired'),
});

const createYearObjectSchema = z.object({
  label: z.string().trim().min(1, 'labelRequired').max(LABEL_MAX_LENGTH),
  startDate: z.string().min(1, 'startDateRequired'),
  endDate: z.string().min(1, 'endDateRequired'),
  terms: z.array(termSchema),
});

const createYearSchema = createYearObjectSchema.refine((data) => data.startDate < data.endDate, {
  path: ['endDate'],
  message: 'INVALID_DATE_RANGE',
});

type CreateYearForm = z.infer<typeof createYearObjectSchema>;

const EMPTY_FORM: CreateYearForm = {
  label: '',
  startDate: '',
  endDate: '',
  terms: [],
};

function parseDraft(raw: string | null): CreateYearForm | null {
  if (!raw) return null;
  try {
    const parsed = createYearObjectSchema.partial().safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return {
      label: parsed.data.label ?? '',
      startDate: parsed.data.startDate ?? '',
      endDate: parsed.data.endDate ?? '',
      terms: parsed.data.terms ?? [],
    };
  } catch {
    return null;
  }
}

function isFormDirty(values: CreateYearForm): boolean {
  return (
    values.label.trim().length > 0 ||
    values.startDate !== '' ||
    values.endDate !== '' ||
    values.terms.length > 0
  );
}

export function CreateYearDialog() {
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');
  const { format: formatLocalized } = useFormatDate();
  const { createYear, loading } = useCreateAcademicYear();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateYearForm>({
    resolver: zodResolver(createYearSchema),
    mode: 'onBlur',
    defaultValues: EMPTY_FORM,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'terms' });

  // Auto-save draft to localStorage (HUPGP)
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (!open || draftRestoredRef.current) return;
    if (typeof window === 'undefined') return;
    const draft = parseDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY));
    if (draft && isFormDirty(draft)) {
      form.reset(draft);
      toast.info(t('draftRestoredTitle'), {
        description: t('draftRestoredDescription'),
        action: {
          label: t('discardDraft'),
          onClick: () => {
            window.localStorage.removeItem(DRAFT_STORAGE_KEY);
            form.reset(EMPTY_FORM);
          },
        },
      });
    }
    draftRestoredRef.current = true;
  }, [open, form, t]);

  const persistDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    const values = form.getValues();
    if (!isFormDirty(values)) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
  }, [form]);

  useEffect(() => {
    if (!open) return;
    const intervalId = window.setInterval(persistDraft, DRAFT_AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [open, persistDraft]);

  const resetAndClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    draftRestoredRef.current = false;
    form.reset(EMPTY_FORM);
    setOpen(false);
  }, [form]);

  // Map Zod/business error codes from message key to translated text (CLFYD + NGIAC)
  const translateErrorKey = useCallback(
    (message: string | undefined): string | undefined => {
      if (!message) return undefined;
      if (message === 'INVALID_DATE_RANGE') return t('errors.INVALID_DATE_RANGE');
      if (message.startsWith('errors.')) return t(message);
      // Treat as an i18n key inside this namespace if it matches a known label
      const knownKeys = [
        'labelRequired',
        'startDateRequired',
        'endDateRequired',
        'termLabelRequired',
        'termDateRequired',
      ] as const;
      if ((knownKeys as readonly string[]).includes(message)) {
        return t(message as (typeof knownKeys)[number]);
      }
      return message;
    },
    [t],
  );

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createYear({
        label: data.label.trim(),
        startDate: data.startDate,
        endDate: data.endDate,
        termStructure: data.terms.length > 0 ? data.terms : undefined,
      });
      toast.success(t('created'));
      resetAndClose();
    } catch (err) {
      const message = extractGraphQLError(err, t('errors.INVALID_DATE_RANGE'));
      if (/overlap/i.test(message)) {
        toast.error(t('errors.ACADEMIC_YEAR_OVERLAP'));
      } else if (/date/i.test(message)) {
        form.setError('endDate', { message: 'INVALID_DATE_RANGE' });
      } else {
        toast.error(message);
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          persistDraft();
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" title={t('newYear')}>
          <Plus className="size-4" aria-hidden="true" />
          {t('newYear')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('newYear')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FieldGroup>
            <Controller
              control={form.control}
              name="label"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t('label')}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder={t('labelPlaceholder')}
                    maxLength={LABEL_MAX_LENGTH}
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${field.name}-description`}
                  />
                  <FieldDescription id={`${field.name}-description`}>
                    {t('labelDescription')} {t('labelFormatHint')}
                  </FieldDescription>
                  {fieldState.error && (
                    <FieldError>{translateErrorKey(fieldState.error.message)}</FieldError>
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="startDate"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>{t('startDate')}</FieldLabel>
                    <DatePickerField
                      id={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={fieldState.invalid}
                      placeholder={t('dateFormatHint')}
                      formatLocalized={formatLocalized}
                      ariaDescribedBy={`${field.name}-description`}
                    />
                    <FieldDescription id={`${field.name}-description`}>
                      {t('startDateDescription')} {t('dateFormatHint')}
                    </FieldDescription>
                    {fieldState.error && (
                      <FieldError>{translateErrorKey(fieldState.error.message)}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="endDate"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>{t('endDate')}</FieldLabel>
                    <DatePickerField
                      id={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={fieldState.invalid}
                      placeholder={t('dateFormatHint')}
                      formatLocalized={formatLocalized}
                      ariaDescribedBy={`${field.name}-description`}
                    />
                    <FieldDescription id={`${field.name}-description`}>
                      {t('endDateDescription')} {t('dateFormatHint')}
                    </FieldDescription>
                    {fieldState.error && (
                      <FieldError>{translateErrorKey(fieldState.error.message)}</FieldError>
                    )}
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          <FieldSet>
            <div className="flex items-center justify-between gap-3">
              <FieldLegend variant="label">{t('termStructure')}</FieldLegend>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ label: '', startDate: '', endDate: '' })}
                className="gap-1.5 text-xs"
                title={t('addTerm')}
              >
                <Plus className="size-3" aria-hidden="true" />
                {t('addTerm')}
              </Button>
            </div>
            <FieldDescription>{t('termStructureDescription')}</FieldDescription>

            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('termsEmpty')}</p>
            ) : (
              <FieldGroup>
                {fields.map((field, index) => {
                  const termNumber = index + 1;
                  return (
                    <div
                      key={field.id}
                      className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Controller
                          control={form.control}
                          name={`terms.${index}.label`}
                          render={({ field: termField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid} className="flex-1">
                              <FieldLabel htmlFor={termField.name} className="sr-only">
                                {t('termLabelAria', { index: termNumber })}
                              </FieldLabel>
                              <Input
                                {...termField}
                                id={termField.name}
                                placeholder={t('termLabelPlaceholder')}
                                className="h-8 text-sm"
                                aria-invalid={fieldState.invalid}
                                aria-label={t('termLabelAria', { index: termNumber })}
                              />
                              {fieldState.error && (
                                <FieldError>
                                  {translateErrorKey(fieldState.error.message)}
                                </FieldError>
                              )}
                            </Field>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="size-8 p-0 text-muted-foreground hover:text-destructive"
                          title={t('removeTerm')}
                          aria-label={t('removeTermAria', { index: termNumber })}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Controller
                          control={form.control}
                          name={`terms.${index}.startDate`}
                          render={({ field: termField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel
                                htmlFor={termField.name}
                                className="text-[11px] text-muted-foreground"
                              >
                                {t('termStart')}
                              </FieldLabel>
                              <Input
                                {...termField}
                                id={termField.name}
                                type="date"
                                className="h-8 text-sm"
                                aria-invalid={fieldState.invalid}
                                aria-label={t('termStartAria', { index: termNumber })}
                              />
                              {fieldState.error && (
                                <FieldError>
                                  {translateErrorKey(fieldState.error.message)}
                                </FieldError>
                              )}
                            </Field>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`terms.${index}.endDate`}
                          render={({ field: termField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel
                                htmlFor={termField.name}
                                className="text-[11px] text-muted-foreground"
                              >
                                {t('termEnd')}
                              </FieldLabel>
                              <Input
                                {...termField}
                                id={termField.name}
                                type="date"
                                className="h-8 text-sm"
                                aria-invalid={fieldState.invalid}
                                aria-label={t('termEndAria', { index: termNumber })}
                              />
                              {fieldState.error && (
                                <FieldError>
                                  {translateErrorKey(fieldState.error.message)}
                                </FieldError>
                              )}
                            </Field>
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </FieldGroup>
            )}
          </FieldSet>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={loading}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? t('creating') : t('createYear')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DatePickerFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  placeholder: string;
  ariaDescribedBy?: string;
  formatLocalized: (date: Date, pattern: string) => string;
}

function DatePickerField({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  placeholder,
  ariaDescribedBy,
  formatLocalized,
}: DatePickerFieldProps) {
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover onOpenChange={(open) => !open && onBlur()}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          className="w-full justify-start text-start font-normal h-9"
          aria-invalid={invalid}
          aria-describedby={ariaDescribedBy}
          data-invalid={invalid || undefined}
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
              onChange(formatDateFn(date, ISO_DATE_FORMAT));
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
