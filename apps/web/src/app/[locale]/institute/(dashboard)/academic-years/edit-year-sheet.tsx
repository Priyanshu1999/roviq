'use client';

import { gql, useMutation } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import {
  Button,
  Can,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
} from '@roviq/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { AcademicYear } from './use-academic-years';

const UPDATE_ACADEMIC_YEAR = gql`
  mutation UpdateAcademicYear($id: ID!, $input: UpdateAcademicYearInput!) {
    updateAcademicYear(id: $id, input: $input) {
      id
      label
      startDate
      endDate
      termStructure { label startDate endDate }
    }
  }
`;

interface EditYearFormValues {
  label: string;
  startDate: string;
  endDate: string;
  terms: Array<{ label: string; startDate: string; endDate: string }>;
}

interface EditYearSheetProps {
  year: AcademicYear | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DRAFT_KEY_PREFIX = 'roviq:draft:academic-year';
const AUTOSAVE_INTERVAL_MS = 30_000;

export function EditYearSheet({ year, open, onOpenChange }: EditYearSheetProps) {
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');
  const { format } = useFormatDate();
  const [mutate, { loading }] = useMutation(UPDATE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears'],
  });

  const isReadOnly = year?.status === 'ARCHIVED';
  const draftKey = year ? `${DRAFT_KEY_PREFIX}:${year.id}` : null;

  const [draftRestored, setDraftRestored] = useState(false);
  const restoredDraftRef = useRef(false);

  const form = useForm<EditYearFormValues>({
    mode: 'onBlur',
    defaultValues: {
      label: '',
      startDate: '',
      endDate: '',
      terms: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'terms',
  });

  const resetToYear = useCallback(
    (source: AcademicYear) => {
      form.reset({
        label: source.label,
        startDate: source.startDate,
        endDate: source.endDate,
        terms: (Array.isArray(source.termStructure) ? source.termStructure : []) as {
          label?: string;
          startDate?: string;
          endDate?: string;
        }[],
      });
    },
    [form],
  );

  // Populate form when year changes; restore draft if present.
  useEffect(() => {
    if (!year) return;
    resetToYear(year);
    restoredDraftRef.current = false;
    setDraftRestored(false);

    if (isReadOnly || typeof window === 'undefined' || !draftKey) return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as EditYearFormValues;
      form.reset(parsed);
      restoredDraftRef.current = true;
      setDraftRestored(true);
    } catch {
      // Corrupt draft — ignore and fall back to server state.
    }
  }, [year, draftKey, isReadOnly, form, resetToYear]);

  // Auto-save draft every 30s and on blur (via watch subscription).
  useEffect(() => {
    if (!open || isReadOnly || !draftKey || typeof window === 'undefined') return;

    const persist = () => {
      if (!form.formState.isDirty) return;
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(form.getValues()));
      } catch {
        // Quota exceeded or unavailable — silent.
      }
    };

    const interval = window.setInterval(persist, AUTOSAVE_INTERVAL_MS);
    const subscription = form.watch(() => persist());

    return () => {
      window.clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [open, isReadOnly, draftKey, form]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined' || !draftKey) return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  const handleDiscardDraft = () => {
    if (!year) return;
    clearDraft();
    resetToYear(year);
    setDraftRestored(false);
  };

  const onSubmit = async (data: EditYearFormValues) => {
    if (!year || isReadOnly) return;

    try {
      await mutate({
        variables: {
          id: year.id,
          input: {
            label: data.label.trim(),
            startDate: data.startDate,
            endDate: data.endDate,
            termStructure: data.terms,
          },
        },
      });
      clearDraft();
      setDraftRestored(false);
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    }
  };

  const sessionRange = useMemo(() => {
    if (!year) return '';
    return t('sessionRange', {
      range: `${format(new Date(year.startDate), 'dd/MM/yyyy')} — ${format(
        new Date(year.endDate),
        'dd/MM/yyyy',
      )}`,
    });
  }, [year, format, t]);

  if (!year) return null;

  const createdOn = t('createdOn', {
    date: format(new Date(year.createdAt), 'dd MMM yyyy'),
  });
  const updatedOn = t('updatedOn', {
    date: format(new Date(year.updatedAt), 'dd MMM yyyy'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="academic-years-edit-sheet"
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        aria-busy={loading}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t('editTitle')}</SheetTitle>
          <SheetDescription>{t('editDescription')}</SheetDescription>
          <p className="mt-1 text-xs text-muted-foreground">{sessionRange}</p>
          {isReadOnly && (
            <output className="mt-2 block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t('readOnlyNotice')}
            </output>
          )}
        </SheetHeader>

        {draftRestored && !isReadOnly && (
          <output
            className="flex items-start justify-between gap-3 border-b bg-muted/40 px-6 py-3"
            aria-live="polite"
          >
            <div className="text-xs">
              <p className="font-medium">{t('draftRestoredTitle')}</p>
              <p className="text-muted-foreground">{t('draftRestoredDescription')}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleDiscardDraft}>
              {t('discardDraft')}
            </Button>
          </output>
        )}

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
          noValidate
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Read-only metadata (FVOLK) */}
            <section
              aria-label={t('editTitle')}
              className="space-y-1 text-xs text-muted-foreground"
            >
              <p>{createdOn}</p>
              <p>{updatedOn}</p>
            </section>

            <Separator />

            <FieldSet disabled={isReadOnly}>
              <FieldLegend className="sr-only">{t('editTitle')}</FieldLegend>

              <FieldGroup>
                <Controller
                  name="label"
                  control={form.control}
                  rules={{ required: t('labelRequired') }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid || undefined}>
                      <FieldLabel htmlFor={field.name}>{t('label')}</FieldLabel>
                      <FieldDescription>{t('labelDescription')}</FieldDescription>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder={t('labelPlaceholder')}
                        aria-invalid={fieldState.invalid || undefined}
                        aria-describedby={`${field.name}-hint`}
                      />
                      <FieldDescription id={`${field.name}-hint`}>
                        {t('labelFormatHint')}
                      </FieldDescription>
                      {fieldState.error?.message && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    name="startDate"
                    control={form.control}
                    rules={{ required: t('startDateRequired') }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor={field.name}>{t('startDate')}</FieldLabel>
                        <FieldDescription>{t('startDateDescription')}</FieldDescription>
                        <Input
                          {...field}
                          id={field.name}
                          type="date"
                          aria-invalid={fieldState.invalid || undefined}
                          aria-describedby={`${field.name}-hint`}
                        />
                        <FieldDescription id={`${field.name}-hint`}>
                          {t('dateFormatHint')}
                        </FieldDescription>
                        {fieldState.error?.message && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="endDate"
                    control={form.control}
                    rules={{ required: t('endDateRequired') }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor={field.name}>{t('endDate')}</FieldLabel>
                        <FieldDescription>{t('endDateDescription')}</FieldDescription>
                        <Input
                          {...field}
                          id={field.name}
                          type="date"
                          min={form.watch('startDate') || undefined}
                          aria-invalid={fieldState.invalid || undefined}
                          aria-describedby={`${field.name}-hint`}
                        />
                        <FieldDescription id={`${field.name}-hint`}>
                          {t('dateFormatHint')}
                        </FieldDescription>
                        {fieldState.error?.message && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />
                </div>
              </FieldGroup>
            </FieldSet>

            <Separator />

            <FieldSet disabled={isReadOnly}>
              <div className="flex items-center justify-between">
                <FieldLegend>{t('termStructure')}</FieldLegend>
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ label: '', startDate: '', endDate: '' })}
                    className="gap-1.5"
                    title={t('addTerm')}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t('addTerm')}
                  </Button>
                )}
              </div>

              {fields.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t('termsEmpty')}</p>
              ) : (
                <FieldGroup className="mt-3 space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border border-border/60 bg-muted/30 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Controller
                          name={`terms.${index}.label` as const}
                          control={form.control}
                          rules={{ required: t('termLabelRequired') }}
                          render={({ field: termField, fieldState }) => (
                            <Field
                              data-invalid={fieldState.invalid || undefined}
                              className="flex-1"
                            >
                              <FieldLabel htmlFor={termField.name} className="sr-only">
                                {t('termLabelAria', { index: index + 1 })}
                              </FieldLabel>
                              <Input
                                {...termField}
                                id={termField.name}
                                placeholder={t('termLabelPlaceholder')}
                                aria-invalid={fieldState.invalid || undefined}
                              />
                              {fieldState.error?.message && (
                                <FieldError>{fieldState.error.message}</FieldError>
                              )}
                            </Field>
                          )}
                        />
                        {!isReadOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="size-9 p-0 text-muted-foreground hover:text-destructive"
                            title={t('removeTerm')}
                            aria-label={t('removeTermAria', { index: index + 1 })}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Controller
                          name={`terms.${index}.startDate` as const}
                          control={form.control}
                          rules={{ required: t('termDateRequired') }}
                          render={({ field: termField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid || undefined}>
                              <FieldLabel htmlFor={termField.name}>{t('termStart')}</FieldLabel>
                              <Input
                                {...termField}
                                id={termField.name}
                                type="date"
                                min={form.watch('startDate') || undefined}
                                max={form.watch('endDate') || undefined}
                                aria-invalid={fieldState.invalid || undefined}
                                aria-label={t('termStartAria', { index: index + 1 })}
                              />
                              {fieldState.error?.message && (
                                <FieldError>{fieldState.error.message}</FieldError>
                              )}
                            </Field>
                          )}
                        />
                        <Controller
                          name={`terms.${index}.endDate` as const}
                          control={form.control}
                          rules={{ required: t('termDateRequired') }}
                          render={({ field: termField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid || undefined}>
                              <FieldLabel htmlFor={termField.name}>{t('termEnd')}</FieldLabel>
                              <Input
                                {...termField}
                                id={termField.name}
                                type="date"
                                min={form.watch(`terms.${index}.startDate`) || undefined}
                                max={form.watch('endDate') || undefined}
                                aria-invalid={fieldState.invalid || undefined}
                                aria-label={t('termEndAria', { index: index + 1 })}
                              />
                              {fieldState.error?.message && (
                                <FieldError>{fieldState.error.message}</FieldError>
                              )}
                            </Field>
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </FieldGroup>
              )}
            </FieldSet>
          </div>

          <SheetFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            {!isReadOnly && (
              <Can I="update" a="AcademicYear">
                <Button
                  data-testid="academic-years-edit-save-btn"
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading && <Spinner className="me-2 size-4" aria-hidden="true" />}
                  {loading ? t('saving') : t('save')}
                </Button>
              </Can>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
